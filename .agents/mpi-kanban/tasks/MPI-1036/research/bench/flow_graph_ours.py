# MPI-1036 bench (Fabio, 2026-10-08): the Video Edit on OUR shipped H3 graph (comfy_workflows/minimax_h3_r2va.json)
# instead of the akatz-ai single pass. The shipped graph is taken as it is - Turbo on (Input_is_Turbo), stage 1 at
# half size with refs 'match', latent upscaler x2, stage 2 3-step windowed refine with refs 'max', same math - plus
# the swap LoRA (where the Flow uses it) and the Flow's own inputs, instruction, describer and source soundtrack
# (flow_graph.py). Fabio picked it over the single pass after R2o/R2p (2026-10-08 late): this is the Flow's graph.
import json, os

import flow_graph as fg

SHIPPED = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../../comfy_workflows/minimax_h3_r2va.json')
# The Flow's own H3 section (single pass), replaced by the shipped one.
FLOW_H3 = ('100', '101', '102', '103', '104', '105', '106', '107', '108', '110', '111', '112', '113', '114', '115', '116', '117')
# Shipped nodes a Video Edit never feeds: the prompt/seed/size/duration inputs (the Flow's own drive them), the
# reference slots past image 1 and video 1, and the generated soundtrack (the source audio is muxed back instead).
UNUSED = ('195', '212', '213', '214', '232', '622', '623', '321', '329', '336', '337', '338', '339', '343', '344', '345',
          '331', '332', '333', '334', '346', '347', '639', '640', '641', '666', '668', '670', '686', '689', '692',
          '606', '610', '862')


def graph(masked_single_pass=False, **kw):
    """flow_graph.graph (same arguments, the same instruction templates) with its H3 section swapped for the
    shipped two-stage one. masked_single_pass: the Flow's shape (Fabio, 2026-10-09) - the masked route keeps
    flow_graph's single pass (S7 lost R1b's sync lock on ours) and the whole frame runs ours; lazy MpiIfElse
    (nodes 60-62, 122) means only the picked route's H3 ever loads."""
    g = fg.graph(**kw)
    if not masked_single_pass:
        for k in FLOW_H3:
            del g[k]
    s = json.load(open(SHIPPED, encoding='utf-8'))
    for k in UNUSED:
        del s[k]
    if masked_single_pass:
        del s['574']  # an output node: it would run our stage 1 on the masked route as well
    assert not set(s) & set(g), set(s) & set(g)
    g.update(s)
    prompt = ['173', 0] if '173' in g else ['172', 0]

    g['444']['inputs']['boolean'] = True  # Input_is_Turbo
    # The swap LoRA, switched exactly as the Flow switches it, ahead of the user-LoRA chain.
    assert '904' not in g and '905' not in g
    g['904'] = fg.node('MpiLoraModel', 'Character Swap LoRA', model=['517', 0], lora_name=fg.SWAP, strength_model=1.0)
    g['905'] = fg.node('MpiIfElse', 'swap LoRA ? : base', boolean=['21', 0], true=['904', 0], false=['517', 0])
    g['529']['inputs']['model'] = ['905', 0]
    # Size: the Flow's render size (masked ? crop : whole frame) into the shipped half-size math (620/621).
    g['620']['inputs']['a'] = ['62', 0]
    g['621']['inputs']['a'] = ['61', 0]
    for ref in ('330', '688'):
        i = g[ref]['inputs']
        for k in [k for k in i if k.startswith(('ref_image_', 'ref_video_', 'ref_audio_')) and k != 'ref_image_size']:
            del i[k]
        i.update(ref_image_1=['11', 0], ref_video_1=['60', 0], prompt=prompt, length=['30', 0])
    g['555']['inputs']['noise_seed'] = ['17', 0]
    g['601']['inputs']['noise_seed'] = ['17', 0]
    if '574' in g:
        g['574']['inputs']['filename_prefix'] = kw.get('prefix', 'MpiVideo_Edit') + '_stage1'
    # Out through the Flow's stitch / source-audio tail.
    if not masked_single_pass:
        g['120']['inputs']['source'] = ['861', 0]
    g['122']['inputs']['false'] = ['861', 0]

    # every link resolves
    for k, n in g.items():
        for v in n['inputs'].values():
            if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str):
                assert v[0] in g, (k, v)
    return g


if __name__ == '__main__':
    g = graph(video='v.mp4', image='p.png', operation=1, who='x', caption=True)
    print(len(g), 'nodes ok')
