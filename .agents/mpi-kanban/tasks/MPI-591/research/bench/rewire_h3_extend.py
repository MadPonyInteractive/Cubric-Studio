"""Rewire comfy_workflows/raw/flow_h3_extend.json: ref2va + guide  ->  fl2va + masked prefix.

Fabio, 2026-09-27: "FL2VA should be the default one for sure. It should land instead of
referencing the video." And, after seeing both arms: expose the context length as a field,
default 39.

WHAT CHANGES AND WHY

  #392 UNETLoader      ref2va -> fl2va       the model that does not take references
  #956 MpiLoraModel    ref2v turbo -> fl2v   keep the LoRA model-matched (loraDeps.js says so)

  #330 MpiH3References  DELETED, replaced by #970 MpiH3ImageToVideo.
       It was never a reference path in this graph - nothing was wired into its ref slots.
       It is core's MiniMaxH3ReferenceToVideo with every slot None, used as a factory for
       the encoded prompt and the empty AV latent. fl2va's equivalent factory is
       MpiH3ImageToVideo with no first_frame/last_frame, which is what every bench arm used.

  #902 guide clip / #903 MiniMaxH3AddGuide / #940 guide audio   DELETED.
       The guide route anchored the previous clip as a keyframe and then had to repair what
       that cost. The prefix route writes the encoded tail into the latent and masks it out
       of sampling, so there is nothing to repair. The node's own docstring is explicit that
       a first-frame guide inside the preserved head fights the prefix.

  #946 flash frame / #947 successor / #948 ColorMatch / #949 ImageBatch   DELETED.
       These exist ONLY to patch the guide route's flash frame. Measured on the arm 39 run
       (check_prefix.py, 2026-09-27): the prefix seam steps 10.0 against a clip median of
       8.1 and a clip max of 17.3 - it is not even the largest step in the clip. No flash,
       nothing to level-match.

  NEW #971 MpiH3EncodeAV     the source, encoded in ONE call -> the context latent
  NEW #972 MpiH3MaskedPrefix the mechanism
  NEW #973 MpiInt "Input_Context"  the field: 39 (default) / 90 / 141

THE HARDCODED 39 IS GONE, AND THE OFFSETS NOW COME FROM THE NODE.
The old graph carried a hard `num_frames 39` with nothing guarding a source shorter than
that, and every downstream offset was the matching literal 40. Now #941 (new frames) and
#942 (generated audio tail) take their start from #972's OWN `context_frames` output - the
value AFTER the node snapped it down to the 39/90/141 grid and to what the clip actually
holds. Ask for 90 of a source that has 50 and the preserved head and the stitch agree with
each other, which is exactly what the old literals could not do.

The duration math (#954) still takes the REQUESTED value from #973, because the target
latent has to be sized before the prefix node runs. A short source therefore yields a
slightly longer tail of new footage, never a broken stitch.

Run:  python rewire_h3_extend.py           (writes; --check prints and writes nothing)
Then: convert raw -> runtime with scripts/sync-raw-workflows.mjs against 48188.
"""
import json
import os
import sys

RAW = r'C:\AI\Mpi\Cubric-Vision\comfy_workflows\raw\flow_h3_extend.json'

FL2VA = 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'
FL2V_LORA = 'minimax-h3\\minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors'
DEFAULT_CONTEXT = 39

DELETE = [330, 902, 903, 940, 946, 947, 948, 949]


class Graph:
    def __init__(self, path):
        self.path = path
        self.d = json.load(open(path, encoding='utf-8'))
        self.by = {n['id']: n for n in self.d['nodes']}

    # ---- lookup
    def n(self, nid):
        return self.by[nid]

    def out_slot(self, nid, name):
        for i, o in enumerate(self.n(nid)['outputs']):
            if o['name'] == name:
                return i
        raise KeyError('%s has no output %r' % (nid, name))

    def in_slot(self, nid, name):
        for i, s in enumerate(self.n(nid).get('inputs', [])):
            if s['name'] == name:
                return i
        raise KeyError('%s has no input %r' % (nid, name))

    # ---- mutation
    def drop_link(self, link_id):
        self.d['links'] = [l for l in self.d['links'] if l[0] != link_id]
        for n in self.d['nodes']:
            for s in n.get('inputs', []) or []:
                if s.get('link') == link_id:
                    s['link'] = None
            for o in n.get('outputs', []) or []:
                if o.get('links'):
                    o['links'] = [x for x in o['links'] if x != link_id]

    def delete(self, nid):
        for l in [l for l in self.d['links'] if l[1] == nid or l[3] == nid]:
            self.drop_link(l[0])
        self.d['nodes'] = [n for n in self.d['nodes'] if n['id'] != nid]
        del self.by[nid]

    def link(self, src, src_name, dst, dst_name, typ):
        """Connect src.src_name -> dst.dst_name, replacing whatever fed dst.dst_name."""
        si, di = self.out_slot(src, src_name), self.in_slot(dst, dst_name)
        old = self.n(dst)['inputs'][di].get('link')
        if old is not None:
            self.drop_link(old)
        self.d['last_link_id'] += 1
        lid = self.d['last_link_id']
        self.d['links'].append([lid, src, si, dst, di, typ])
        self.n(dst)['inputs'][di]['link'] = lid
        o = self.n(src)['outputs'][si]
        o.setdefault('links', [])
        if o['links'] is None:
            o['links'] = []
        o['links'].append(lid)
        return lid

    def widget(self, nid, name, value):
        n = self.n(nid)
        named = n.setdefault('widgets_values_named', {})
        keys = list(named.keys())
        if name not in named:
            raise KeyError('%s has no widget %r (has %s)' % (nid, name, keys))
        named[name] = value
        n['widgets_values'][keys.index(name)] = value

    def widget_input(self, nid, name, typ):
        """Expose a widget as an input slot so a link can drive it (LiteGraph shape)."""
        n = self.n(nid)
        for s in n.setdefault('inputs', []):
            if s['name'] == name:
                return
        n['inputs'].append({'label': name, 'name': name, 'type': typ,
                            'widget': {'name': name}, 'link': None})

    def add(self, nid, typ, title, pos, inputs, outputs, widgets=None, props=None):
        node = {
            'id': nid, 'type': typ, 'pos': pos, 'size': [300, 120], 'flags': {},
            'order': nid, 'mode': 0,
            'inputs': [dict(i, link=None) for i in inputs],
            'outputs': [dict(o, links=[]) for o in outputs],
            'title': title,
            'properties': {'Node name for S&R': typ, 'widget_ue_connectable': {}},
        }
        if widgets:
            node['widgets_values'] = list(widgets.values())
            node['widgets_values_named'] = dict(widgets)
        if props:
            node['properties'].update(props)
        self.d['nodes'].append(node)
        self.by[nid] = node
        self.d['last_node_id'] = max(self.d['last_node_id'], nid)
        return node

    def save(self):
        blob = json.dumps(self.d, indent=2, ensure_ascii=False)
        json.loads(blob)
        with open(self.path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(blob)


def sig(t, name, label=None, widget=False):
    s = {'label': label or name, 'name': name, 'type': t, 'link': None}
    if widget:
        s['widget'] = {'name': name}
    return s


def main(check=False):
    g = Graph(RAW)

    # 1. the model, and its model-matched LoRA
    g.widget(392, 'unet_name', FL2VA)
    g.widget(956, 'lora_name', FL2V_LORA)

    # 2. the fl2va conditioning factory, in place of the reference factory
    g.add(970, 'MpiH3ImageToVideo', 'H3 conditioning (fl2va - no references, no guide)',
          [1100, 900],
          [sig('CLIP', 'clip'), sig('VAE', 'vae'), sig('STRING', 'prompt', widget=True),
           sig('INT', 'width', widget=True), sig('INT', 'height', widget=True),
           sig('INT', 'length', widget=True)],
          [{'name': 'positive', 'type': 'CONDITIONING'}, {'name': 'latent', 'type': 'LATENT'}],
          widgets={'prompt': '', 'width': 1344, 'height': 768, 'length': 124})

    # 3. the source encoded in ONE call, and the prefix that preserves its tail
    g.add(971, 'MpiH3EncodeAV', 'Encode the source (one call - keeps the motion)',
          [1100, 1250],
          [sig('VAE', 'vae'), sig('IMAGE', 'images'), sig('VAE', 'audio_vae'),
           sig('AUDIO', 'audio')],
          [{'name': 'latent', 'type': 'LATENT'}, {'name': 'info', 'type': 'STRING'}])

    g.add(973, 'MpiInt', 'Input_Context', [700, 1450], [],
          [{'name': 'int', 'type': 'INT'}], widgets={'int': DEFAULT_CONTEXT})

    g.add(972, 'MpiH3MaskedPrefix', 'THE MECHANISM (preserved head, masked out of sampling)',
          [1500, 1100],
          [sig('LATENT', 'latent'), sig('LATENT', 'context_latent'),
           sig('INT', 'context_frames', widget=True)],
          [{'name': 'latent', 'type': 'LATENT'}, {'name': 'context_frames', 'type': 'INT'},
           {'name': 'new_frames', 'type': 'INT'}, {'name': 'report', 'type': 'STRING'}],
          widgets={'context_frames': DEFAULT_CONTEXT})

    g.link(390, 'CLIP', 970, 'clip', 'CLIP')
    g.link(388, 'VAE', 970, 'vae', 'VAE')
    g.link(232, 'Text', 970, 'prompt', 'STRING')
    g.link(916, 'width', 970, 'width', 'INT')
    g.link(916, 'height', 970, 'height', 'INT')
    g.link(213, 'frames', 970, 'length', 'INT')

    g.link(388, 'VAE', 971, 'vae', 'VAE')
    g.link(916, 'IMAGE', 971, 'images', 'IMAGE')
    g.link(387, 'VAE', 971, 'audio_vae', 'VAE')
    g.link(906, 'output', 971, 'audio', 'AUDIO')   # has_audio ? source : silence

    g.link(970, 'latent', 972, 'latent', 'LATENT')
    g.link(971, 'latent', 972, 'context_latent', 'LATENT')
    g.link(973, 'int', 972, 'context_frames', 'INT')

    # 4. the sampler now rides the prefixed latent; the guider takes fl2va conditioning
    g.link(970, 'positive', 423, 'conditioning', 'CONDITIONING')
    g.link(972, 'latent', 435, 'latent_image', 'LATENT')

    # 5. the guide route and its repairs come out
    for nid in DELETE:
        g.delete(nid)

    # 6. the stitch offsets come from the node's OWN snapped count, not a literal
    g.widget_input(941, 'start_index', 'INT')
    g.widget_input(941, 'num_frames', 'INT')
    g.widget(941, 'start_index', DEFAULT_CONTEXT)
    g.link(972, 'context_frames', 941, 'start_index', 'INT')
    g.link(941, 'IMAGE', 904, 'new_images', 'IMAGE')

    g.widget_input(942, 'start', 'INT')
    g.widget(942, 'start', DEFAULT_CONTEXT)
    g.link(972, 'context_frames', 942, 'start', 'INT')

    # 7. the target has to hold the preserved head as well as the new footage.
    #    This one takes the REQUESTED value: the latent is sized before #972 runs.
    g.widget(954, 'math_expression', 'a + b/24')
    g.widget_input(954, 'b', '*')
    g.link(973, 'int', 954, 'b', 'INT')

    report(g)
    if check:
        print('\n--check: nothing written')
        return
    g.save()
    print('\nwrote %s' % RAW)


def report(g):
    print('nodes %d  links %d' % (len(g.d['nodes']), len(g.d['links'])))
    print('deleted: %s' % DELETE)
    for nid in (392, 956, 954, 941, 942, 970, 971, 972, 973):
        n = g.by.get(nid)
        if not n:
            continue
        print('  #%s %-22s %s' % (nid, n['type'],
                                  json.dumps(n.get('widgets_values_named', {}))[:90]))
    dangling = [(n['id'], s['name']) for n in g.d['nodes'] for s in n.get('inputs', [])
                if s.get('link') is None and not s.get('widget') and s.get('shape') != 7]
    print('unconnected non-widget inputs: %s' % (dangling or 'none'))
    ids = {n['id'] for n in g.d['nodes']}
    bad = [l for l in g.d['links'] if l[1] not in ids or l[3] not in ids]
    print('links pointing at deleted nodes: %s' % (bad or 'none'))


if __name__ == '__main__':
    main(check='--check' in sys.argv)
