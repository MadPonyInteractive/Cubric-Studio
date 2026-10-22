"""MPI-1212: FLUX.3 with BFL-shaped prompts - the best case, before any Flow is called a loss.

BFL says FLUX.3 needs its prompt upsampler (a VLM that SEES the references). The bench so far fed it
the Flow's Klein/Qwen wording. Here each case's prompt is written by hand, looking at the real inputs,
the way BFL's i2i upsampler system prompt asks (MPI-1181 research/bfl_pup_system_prompts.json `i2i`):
a generation request when references are composed into a new frame, referents by real appearance
and by ordinal ("the first image"), no angle-bracket tokens, concrete end states. If FLUX.3 still
loses with these, the model is the limit, not the wording. Per-run prompts like these would need the
Enhancer (a seeing one) in the Flow - wiring work, noted, not built.

  python bfl.py dry
  python bfl.py <port> <graph>... --seeds 111,222 [--variants bfl_turbo,bfl_base]
Outputs: out/<graph>/bfl-<model>_<seed>_*.png; sheet: `sheet.py <graph> --bfl`.
"""
import json, os, sys
import flowbench as fb
import scribble3

PROMPTS = {
    'scr1_0': (
        'Create a full-color outdoor photograph of the landscape laid out in the first image, which is a rough '
        'finger-painted drawing used only for where things sit and how big they are. In the upper left, a large '
        'pale-yellow sun glows low in a clear blue sky. Across the top, three grey rocky mountains with sharp peaks '
        'and small patches of snow run from frame-left to the upper right. Below them a wide blue river flows '
        'diagonally from the left edge to the right edge. The foreground is a bright green grassy field with four '
        'evergreen trees standing in a row from frame-left to frame-right, each on a brown trunk with spreading '
        'roots, the two on the right taller. Every shape becomes the real thing: rock, snow, moving water, grass '
        'blades, bark and needles, with daylight shadows; no line, brush stroke or flat paint from the drawing remains.'
    ),
    'scr2_0': (
        'Create a full-color indoor photograph of the bedroom laid out in the first image, which is a rough orange '
        'and pink line drawing used only for where things sit and how big they are. In the lower half, a wooden bed '
        'with a slatted side runs across the frame, its headboard at frame-left. A woman with fair skin and long '
        'brown hair lies on her back on it, belly up, looking at the ceiling, tired; her head rests on a pillow by '
        'the headboard, one knee is raised and bent, and her other leg hangs over the side of the bed toward the '
        'floor. She has natural anatomy: one head, two arms, two legs. In the upper right, a four-pane window shows '
        'snowy mountains under a pale sky. Plain light walls and a wooden floor. Every outline becomes real wood, '
        'fabric, skin and glass; no drawn line remains.'
    ),
    'csfi1_2': (
        'Create a studio photograph of a character reference sheet of the man from the first image, given the body '
        'from the second image. He has fair skin, short black hair swept up and back with loose curls on top and a '
        'skin fade at the sides, a trimmed dark beard and a thin silver cuff on his ear. His body is the muscular '
        'build of the second image, in a fitted grey crew-neck t-shirt, black jogger pants and army boots. One '
        'continuous frame on a plain smooth grey seamless studio backdrop: on the left, two narrow full-body standing '
        'views of equal width, one from the front and one from directly behind, arms relaxed at his sides; the right '
        'half is a head-and-shoulders portrait that keeps the turn and expression of the first image. Natural skin '
        'texture with pores and stubble. His face, hair and ear cuff stay exactly as in the first image.'
    ),
    'csfi2_1': (
        'Create a character reference sheet of the girl from the first image, in the same glossy 3D-rendered anime '
        'style. She has pale skin with pink-blushed cheeks, long wavy chestnut-brown hair with straight bangs, large '
        'amber eyes with dark lashes, small gold bead earrings and a grey off-the-shoulder ruffled top, with a '
        'knee-length grey skirt and grey flat shoes. One continuous frame on a plain smooth grey seamless studio '
        'backdrop: on the left, two narrow full-body standing views of equal width, one from the front and one from '
        'directly behind, arms relaxed at her sides; the right half is a head-and-shoulders portrait turned 45 degrees '
        'toward frame-left, the near ear visible. Her face, hair, eyes and earrings stay exactly as in the first image.'
    ),
    # Editor (Qwen slot): the text goes into the graph's Input_Positive, which every edit encode reads.
    # Tattoo fix (Fabio 2026-10-22): run 1 carried the reference's bikini over and left the close-up bare.
    'cseq2_0': (
        'Edit the character reference sheet in the first image: cover the woman\'s skin with the full-body '
        'blackwork tattoo from the second image, and take nothing else from the second image. The tattoo is large '
        'solid black panels split by channels of bare skin, edged with fine copper-toned linework and dotted borders, '
        'a fan-shaped ornamental flower at the centre of the stomach, mirrored sweeping shapes over the chest and '
        'collarbones, and solid black legs crossed by thin curving lines. It shows in all three views: the front '
        'full-body view on the left covers her chest, stomach, arms and legs; the full-body view from behind carries '
        'the same design across her back, buttocks and the backs of her legs; the close-up portrait on the right shows '
        'it across her shoulders, collarbones and upper chest up to the base of the neck. Her face stays bare. The '
        'bikini, choker, phone and room of the second image are not part of the tattoo and do not appear: she wears '
        'exactly what she wears in the first image. Her face, pink-and-black bob, smile, skin tone, pose, the plain '
        'grey backdrop and the three-panel layout stay exactly as in the first image.'
    ),
    # Clothed Qwen-slot categories (local bench). Undress (cseq7) is not benched: Fabio, FLUX.3 cannot do nudity.
    'cseq3_0': (
        'Edit the character reference sheet in the first image so the woman is extremely overweight in all three '
        'views: a very large round belly, wide heavy hips and thighs, thick upper arms, a soft double chin and full '
        'rounded cheeks. In the front full-body view and the full-body view from behind she stands in the same pose, '
        'the white halter mini dress with the open back stretched over her larger body, the same black high heels. '
        'The close-up portrait on the right shows the same fuller face, chin, neck and shoulders, with the same smile. '
        'Her black-to-pink bob with a fringe, her face, skin tone, the plain grey backdrop and the three-panel layout '
        'stay exactly as in the first image.'
    ),
    'cseq4_0': (
        'Edit the character reference sheet in the first image: the woman\'s long wavy light-brown hair becomes a '
        'chin-length straight bob with a full blunt fringe, black at the roots fading to bubblegum pink at the ends. '
        'The front full-body view shows the bob and fringe framing her face; the full-body view from behind shows the '
        'bob ending just above her shoulders, black at the crown fading to pink, her neck and the dress straps '
        'visible; the close-up portrait on the right shows the fringe just above her eyebrows and the pink ends at her '
        'jaw. Her face, smile, skin, white halter mini dress, black high heels, the plain grey backdrop and the '
        'three-panel layout stay exactly as in the first image.'
    ),
    'cseq5_0': (
        'Edit the character reference sheet in the first image: the bearded man wears a small black nylon crossbody '
        'sling bag on the front of his chest, its zip pocket facing out, on a thin black strap that runs over his '
        'right shoulder and diagonally across his back to his left hip. The front full-body view shows the bag on his '
        'chest and the strap over the shoulder; the full-body view from behind shows only the strap crossing his back; '
        'the close-up portrait on the right shows the strap running over his shoulder and down across his chest, the '
        'top of the bag at the lower edge. His face, grey beard, black hair, grey t-shirt, black joggers, tan boots, '
        'the plain grey backdrop and the three-panel layout stay exactly as in the first image.'
    ),
    # makeup: this leg's first image is the graph's crop of the same man's face twice, the second the makeup photo
    'cseq6_2': (
        'Edit the first image, which shows the same dark-haired man\'s face twice, so both faces wear the makeup '
        'from the second image: black spiderweb face paint spreading from the brow and across the forehead, thick '
        'black around both eyes with bright orange eyeshadow on the lids, sharp black eyeliner, long false lashes, '
        'thin black web lines running down the cheeks, and glossy black lipstick. Take only the makeup from the '
        'second image, not the woman, her white hair or her lace top. Each face keeps its own shape, eyes, nose, '
        'eyebrows, stubble, black hair, skin tone and turn exactly as in the first image.'
    ),
    # child age 10: the Qwen leg rebuilds the Klein-aged sheet into a child's proportions (from-images graph)
    'cseq8_3': (
        'Create a studio photograph of a character reference sheet of the girl from the first image as a '
        '10-year-old child with a child\'s height and body proportions: a short, small body, shorter arms and legs, '
        'a shorter torso and a larger head for her body. She has long straight light-brown hair, fair skin, grey-blue '
        'eyes and a soft smile, and wears a cream button-up knit cardigan over a plain top, blue jeans and brown '
        'ankle boots. One continuous frame on a plain smooth grey seamless studio backdrop: on the left, two narrow '
        'full-body standing views of equal width, one from the front and one from directly behind, arms relaxed at her '
        'sides; the right half is a head-and-shoulders portrait that keeps the turn and expression of the first image. '
        'Her face and hair stay as in the first image.'
    ),
}


def build(cap, variant):
    _, model = variant.split('_')
    name = cap['_name']
    g = cap['graph']
    qwen = any(str(v['inputs'].get('unet_name', '')).startswith(fb.QWEN_UNETS) for v in g.values())
    var = 'flux3turbo' if model == 'turbo' else 'flux3base'
    g = (fb.swap_qwen if qwen else fb.swap)(g, var)
    pos = [v for v in g.values() if v.get('_meta', {}).get('title') == 'Input_Positive']
    if name.startswith('cseq'):   # editor: one text node feeds every edit encode
        assert len(pos) == 1, f'{name}: expected one Input_Positive, found {len(pos)}'
        pos[0]['inputs']['string'] = PROMPTS[name]
        fb.check(g, fb.QWEN_UNETS)
        return g
    hits = 0
    for v in g.values():
        if v['class_type'] == 'MpiFlux3References' or (
                v['class_type'] == 'CLIPTextEncode' and v.get('_meta', {}).get('title') == 'Encode Blend Instruction'):
            v['inputs']['prompt' if qwen else 'text'] = PROMPTS[name]
            hits += 1
    assert hits == 1, f'{name}: expected one FLUX.3 encode, found {hits}'
    fb.check(g, fb.QWEN_UNETS if qwen else fb.KLEIN_UNETS)
    return g


def load(name):
    cap = json.load(open(os.path.join(fb.HERE, 'graphs', f'{name}.json'), encoding='utf-8'))
    return {'_name': name, 'graph': cap['graph']}


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'dry':
        for name in PROMPTS:
            for v in ('bfl_turbo', 'bfl_base'):
                g = build(load(name), v)
            print(name, 'ok', len(g), 'nodes', len(PROMPTS[name].split()), 'words')
        sys.exit(0)
    seeds = [int(s) for s in a[a.index('--seeds') + 1].split(',')]
    variants = a[a.index('--variants') + 1].split(',') if '--variants' in a else ['bfl_turbo', 'bfl_base']
    graphs = a[1:a.index('--seeds')]
    ok = True
    for name in graphs:   # one graph at a time so build() knows the case
        ok &= scribble3.main(a[0], [name], seeds, variants, lambda _g, v, n=name: build(load(n), v), '')
    sys.exit(0 if ok else 1)
