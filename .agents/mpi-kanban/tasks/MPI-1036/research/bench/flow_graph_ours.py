# MPI-1036 bench (Fabio, 2026-10-08): the Video Edit on OUR shipped H3 graph (comfy_workflows/minimax_h3_r2va.json)
# instead of the akatz-ai single pass. The shipped graph is taken as it is - Turbo on (Input_is_Turbo), stage 1 at
# half size with refs 'match', latent upscaler x2, stage 2 3-step windowed refine with refs 'max', same math - plus
# the swap LoRA (where the Flow uses it) and the Flow's own inputs, instruction, describer and source soundtrack
# (flow_graph.py). The results decide which graph the Flow ships with.
import json, os

import flow_graph as fg
from flow_graph import LOOK, NO_PHOTO, PHOTO, TAIL_MASKED, TAIL_WHOLE  # noqa: F401  run_flow's composed() reads these

SHIPPED = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../../comfy_workflows/minimax_h3_r2va.json')
# The Flow's own H3 section (single pass), replaced by the shipped one.
FLOW_H3 = ('100', '101', '102', '103', '104', '105', '106', '107', '108', '110', '111', '112', '113', '114', '115', '116', '117')
# Shipped nodes a Video Edit never feeds: the prompt/seed/size/duration inputs (the Flow's own drive them), the
# reference slots past image 1 and video 1, and the generated soundtrack (the source audio is muxed back instead).
UNUSED = ('195', '212', '213', '214', '232', '622', '623', '321', '329', '336', '337', '338', '339', '343', '344', '345',
          '331', '332', '333', '334', '346', '347', '639', '640', '641', '666', '668', '670', '686', '689', '692',
          '606', '610', '862')


# Swap the person, keeping the clip's room, in MiniMax's own VIDEO-EDITING format (ref-en.txt, the h3-prompt-writing
# skill: subject_definitions / summary "[video editing]" / retention_analysis / detailed_description / the two sound
# fields). Positive only (Fabio, 2026-10-08): the clip's room is a subject kept fully_preserved, the picture gives only
# the character (attribute_transfer), and the picture's own room is never named. R2o lost the room on the old wording.
EDIT_SWAP = """subject_definitions:
<Video 1> is the source video for the target video edit.
<Subject 1> is the character in <Picture 1>. {look}
<Subject 2> is {who} in <Video 1>.
<Subject 3> is the location of <Video 1>: {kept}

summary:
[video editing] The target video is an edited version of <Video 1>. <Subject 1> takes the place of <Subject 2> and performs every move of <Subject 2> in <Subject 3>, with the camera, light and timing of <Video 1>.

retention_analysis:
<Video 1> (whole video): partially_preserved - the camera framing and movement, the light, the colour grade and the timing of every move are kept; only the look of <Subject 2> changes.
<Subject 1> (appears in [Shot 1]): attribute_transfer - the face, skin, hair, outfit and accessories of the character in <Picture 1> are transferred onto <Subject 2>.
<Subject 2> (appears in [Shot 1]): partially_preserved - the position, scale, pose, every movement, expression and mouth movement are kept; the face, hair and clothes are those of <Subject 1>.
<Subject 3> (appears in [Shot 1]): fully_preserved - the room, its furniture, walls, objects and light stay exactly as in <Video 1>.

detailed_description:
The target video keeps the look of <Video 1>: its lighting, colour grade and handheld phone framing.
[Shot 1] In <Subject 3>, <Subject 1> performs exactly what <Subject 2> does in <Video 1>, move for move from the first frame, at the same place in the frame and the same size, with the face, hair, outfit and accessories of <Picture 1> from every angle, the back of the head and outfit showing whenever <Subject 2> turns away. {words}
The camera frames the shot exactly as <Video 1> does.

overall_soundscape: The sound of <Video 1> continues unchanged.
non_diegetic_music: N/A"""


def graph(edit_format=False, room='', **kw):
    """edit_format: template 1 in the vendor editing format; room: the clip's location in words (the app would fill
    it from the clip's first frame, as Input_Kept does for a background change)."""
    g = fg.graph(**kw)
    if edit_format:
        # ponytail: bench bakes the room in; the Flow needs a FlowDef `describe` entry (op 1 Kept = the clip's place)
        g['71']['inputs']['string'] = EDIT_SWAP.replace('{kept}', room)
    for k in FLOW_H3:
        del g[k]
    s = json.load(open(SHIPPED, encoding='utf-8'))
    for k in UNUSED:
        del s[k]
    assert not set(s) & set(g), set(s) & set(g)
    g.update(s)
    prompt = ['173', 0] if '173' in g else ['172', 0]

    g['444']['inputs']['boolean'] = True  # Input_is_Turbo
    # The swap LoRA, switched exactly as the Flow switches it, ahead of the user-LoRA chain.
    g['104'] = fg.node('MpiLoraModel', 'Character Swap LoRA', model=['517', 0], lora_name=fg.SWAP, strength_model=1.0)
    g['105'] = fg.node('MpiIfElse', 'swap LoRA ? : base', boolean=['21', 0], true=['104', 0], false=['517', 0])
    g['529']['inputs']['model'] = ['105', 0]
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
    g['574']['inputs']['filename_prefix'] = kw.get('prefix', 'MpiVideo_Edit') + '_stage1'
    # Out through the Flow's stitch / source-audio tail.
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
