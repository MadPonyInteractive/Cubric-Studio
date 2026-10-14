"""MPI-1086 eye test 2 (Fabio, 2026-10-14): ONE graph per Character Sheet Editor route, every step a version of the card.

Both edit graphs (comfy_workflows/raw/flow_character_sheet_edit.json = Klein, ..._edit_qwen.json = Qwen) get:
  * the Headless front body pass IN the graph (the nodes of raw/flow_character_sheet_headless.json, cloned), fed the
    edit's own picture through an MpiIfElseInverted gate on `Input_Headless`: off, every node after the gate is
    blocked, `Output_Image_3` is skipped and SAM3 never runs. The app lands `Output_Image_3` as the headless version.
Qwen only (hair from a picture):
  * `Input_Is_Mannequin`: the reference already IS a mannequin (the describer says so) -> picture 2 is the reference
    as given and the Klein mannequin step never runs (lazy MpiIfElse).
  * the mannequin it builds is captured as `Output_Image` (gated the same way, so Body shape and a given mannequin
    emit nothing); the edit's capture becomes `Output_Image_2`.
Node shapes are CLONED from raw graphs, so the widget order is the converter's. Idempotent: refuses to run twice.
Then convert each file ALONE: node scripts/workflow-to-api.mjs <raw> <api>, and scripts/validate-injection-rules.mjs.
usage: patch_raw_versions.py
"""
import copy, json

RAW = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/'
HL = {n['id']: n for n in json.load(open(RAW + 'flow_character_sheet_headless.json', encoding='utf-8'))['nodes']}
HL_LINKS = json.load(open(RAW + 'flow_character_sheet_headless.json', encoding='utf-8'))['links']
INVERTED = {  # MpiIfElseInverted, as the frontend saves it (G:/ComfyUi bench workflow LTX-2.3_nerdyRodent.json)
    'id': 0, 'type': 'MpiIfElseInverted', 'pos': [0, 0], 'size': [270, 78], 'flags': {}, 'order': 0, 'mode': 0,
    'inputs': [{'localized_name': 'input', 'name': 'input', 'type': '*', 'link': None},
               {'localized_name': 'boolean', 'name': 'boolean', 'type': 'BOOLEAN', 'widget': {'name': 'boolean'},
                'link': None}],
    'outputs': [{'localized_name': 'out_a', 'name': 'out_a', 'type': '*', 'links': []},
                {'localized_name': 'out_b', 'name': 'out_b', 'type': '*', 'links': []}],
    'properties': {'cnr_id': 'ComfyUi-MpiNodes', 'Node name for S&R': 'MpiIfElseInverted'},
    'widgets_values': [True]}


class Graph:
    def __init__(self, name):
        self.path = RAW + name
        self.raw = open(self.path, 'rb').read().decode('utf-8')
        self.r = json.loads(self.raw)
        self.by = {n['id']: n for n in self.r['nodes']}
        self.nid, self.lid = self.r['last_node_id'], self.r['last_link_id']
        if any(n.get('title') == 'Input_Headless' for n in self.r['nodes']):
            raise SystemExit(f'{name}: already patched')

    def link_of(self, dst, dname):
        lid = next(i for i in self.by[dst]['inputs'] if i['name'] == dname)['link']
        return next(l for l in self.r['links'] if l[0] == lid)

    def clone(self, n, title, pos, widgets=None):
        self.nid += 1
        c = copy.deepcopy(n)
        c.update({'id': self.nid, 'pos': pos, 'order': 100 + self.nid, 'mode': 0})
        if title is None:
            c.pop('title', None)
        else:
            c['title'] = title
        for i in c['inputs']:
            i['link'] = None
        for o in c['outputs']:
            o['links'] = []
        if widgets is not None:
            c['widgets_values'] = widgets
        c.pop('widgets_values_named', None)
        self.r['nodes'].append(c)
        self.by[self.nid] = c
        return self.nid

    def wire(self, src, sslot, dst, dname):
        i = next(i for i in self.by[dst]['inputs'] if i['name'] == dname)
        self.lid += 1
        self.r['links'].append([self.lid, src, sslot, dst, self.by[dst]['inputs'].index(i),
                                self.by[src]['outputs'][sslot]['type']])
        o = self.by[src]['outputs'][sslot]
        o['links'] = (o.get('links') or []) + [self.lid]
        i['link'] = self.lid

    def gate(self, src, sslot, boolean, title, pos):
        """out_b of an MpiIfElseInverted: `src` when `boolean`, else an ExecutionBlocker (all after it skip)."""
        g = self.clone(INVERTED, title, pos)
        self.wire(src, sslot, g, 'input')
        self.wire(boolean, 0, g, 'boolean')
        return g

    def headless(self, edit_src, flag_like, sam3_loader, x0, y0):
        """Clone the Headless graph after the edit: its Input_Image becomes the gated edit picture."""
        flag = self.clone(flag_like, 'Input_Headless', [x0, y0], [False])
        g = self.gate(edit_src[0], edit_src[1], flag, 'the edit, when Headless front body is on', [x0, y0 + 120])
        size = self.clone(self.by[self.size_like], 'the edit size', [x0, y0 + 240])
        self.wire(g, 1, size, 'image')
        # Input_Image's slots -> the gate's out_b (image) and the size node (width 0, height 1).
        src_map = {(900, 0): (g, 1), (900, 2): (size, 0), (900, 3): (size, 1)}
        ids = {}
        for hid, n in sorted(HL.items()):
            if hid == 900 or (hid == 753 and sam3_loader is not None):
                continue
            title = 'Output_Image_3' if hid == 882 else n.get('title')
            ids[hid] = self.clone(n, title, [x0 + 320 + n['pos'][0] * 0.2, y0 + n['pos'][1] * 0.2],
                                  n.get('widgets_values'))
        if sam3_loader is not None:
            src_map[(753, 0)], src_map[(753, 1)] = (sam3_loader, 0), (sam3_loader, 1)
        for _, s, ss, d, ds, _t in HL_LINKS:
            src = src_map.get((s, ss)) or (ids[s], ss)
            self.wire(src[0], src[1], ids[d], HL[d]['inputs'][ds]['name'])
        return flag

    def save(self):
        self.r['last_node_id'], self.r['last_link_id'] = self.nid, self.lid
        nl = '\r\n' if '\r\n' in self.raw else '\n'
        out = json.dumps(self.r, indent=2, ensure_ascii=False).replace('\n', nl)
        open(self.path, 'wb').write((out + (nl if self.raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))


# Klein: edit -> headless. Its own SAM3 loader (node 13, the locks') serves the headless pass too.
k = Graph('flow_character_sheet_edit.json')
k.size_like = 43
assert k.by[61]['title'] == 'Output_Image' and k.by[13]['type'] == 'CheckpointLoaderSimple'
edit = k.link_of(61, 'images')
k.headless((edit[1], edit[2]), k.by[69], 13, 4200, 1800)
k.save()
print(f'klein: nodes -> {k.nid}, links -> {k.lid}')

# Qwen: mannequin -> edit -> headless.
q = Graph('flow_character_sheet_edit_qwen.json')
q.size_like = 146
assert q.by[35]['title'] == 'Output_Image' and q.by[155]['title'] == 'the mannequin'
edit = q.link_of(35, 'images')
q.by[35]['title'] = 'Output_Image_2'
# Picture 2: the reference as given when it is a mannequin already, else the one Klein builds (lazy: Klein never runs).
is_m = q.clone(q.by[137], 'Input_Is_Mannequin', [0, 1500], [False])
pic2 = q.clone(q.by[158], 'picture 2: the reference itself when it is a mannequin', [3000, 1500], [True])
old = q.link_of(157, 'images.image_2')
q.wire(136, 0, pic2, 'true')
q.wire(old[1], old[2], pic2, 'false')
q.wire(is_m, 0, pic2, 'boolean')
q.r['links'] = [l for l in q.r['links'] if l[0] != old[0]]
q.by[old[1]]['outputs'][old[2]]['links'].remove(old[0])
q.wire(pic2, 0, 157, 'images.image_2')
# The mannequin as Output_Image, only when it was built (a picture given AND wanted AND not a mannequin already).
built = q.clone(q.by[138], 'the mannequin was built', [0, 1640], ['a_true_b_false'])
q.wire(138, 0, built, 'a')
q.wire(is_m, 0, built, 'b')
pick = q.clone(q.by[158], 'the mannequin, or a stand-in never shown', [3000, 1640], [True])
q.wire(155, 0, pick, 'true')
q.wire(11, 0, pick, 'false')
q.wire(built, 0, pick, 'boolean')
g = q.gate(pick, 0, built, 'the mannequin, only when built', [3320, 1640])
cap = q.clone(q.by[35], 'Output_Image', [3640, 1640])
q.wire(g, 1, cap, 'images')
q.headless((edit[1], edit[2]), q.by[137], None, 4200, 1800)
q.save()
print(f'qwen: nodes -> {q.nid}, links -> {q.lid}')
