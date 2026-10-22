"""MPI-1212 Phase 2a step 1: can a TEMPLATE replace the hand-written BFL prompt in the Editor's FLUX.3 route?

The hand-written prompts (bfl.py) name what the agent SAW: her bob, his grey beard, the white halter dress.
In the app the Editor's prompt builder knows only the category, the user's words, the age and the clothes
phrase. These templates take exactly those (copied from the captured app graphs' Input_Positive) and keep the
BFL shape: edit request, per-view end states, a generic keep-list. Template loses = the route needs a seeing
Enhancer first.

  python tpl.py dry
  python tpl.py <port> cseq3_0 cseq5_0 cseq8_3 --seeds 111,222      (variant tpl_turbo)
Sheet: `sheet.py <graph> --tpl` (today | hand-written | template).
"""
import sys
import bfl
import scribble3

LAYOUT = 'the plain grey backdrop and the three-panel layout'


def body(words):
    return (f'Edit the character reference sheet in the first image so the character is {words[0].lower() + words[1:]} '
            'in all three views. In the front full-body view and the full-body view from behind the character stands in '
            'the same pose, the same clothes and shoes fitted to the new body. The close-up portrait on the right shows '
            'the same change in the face, chin, neck and shoulders, with the same expression. The character\'s face, '
            f'hair, skin tone, {LAYOUT} stay exactly as in the first image.')


def accessory(words):
    return ('Edit the character reference sheet in the first image: the character wears '
            f'{words[0].lower() + words[1:].rstrip(".")}. The front full-body view on the left, the full-body view from '
            'behind and the close-up portrait on the right each show it wherever it can be seen from that side. Add '
            'nothing else: no other gear, bags, belts or straps. The character\'s face, hair, skin, clothes, shoes, '
            f'{LAYOUT} stay exactly as in the first image.')


def child(age, clothes):
    return ('Create a studio photograph of a character reference sheet of the person from the first image as a '
            f'{age}-year-old child with a child\'s height and body proportions: a short, small body, shorter arms and '
            f'legs, a shorter torso and a larger head for the body, wearing {clothes.lower().rstrip(".")}. One '
            'continuous frame on a plain smooth grey seamless studio backdrop: on the left, two narrow full-body '
            'standing views of equal width, one from the front and one from directly behind, arms relaxed at the sides; '
            'the right half is a head-and-shoulders portrait that keeps the turn and expression of the first image. '
            'The face and hair stay as in the first image.')


# inputs = what the app passed for each case (captured graphs' Input_Positive)
PROMPTS = {
    'cseq3_0': body('Extremely overweight'),
    'cseq5_0': accessory('A small black crossbody sling bag worn on the chest, its strap over one shoulder and '
                         'across the back.'),
    'cseq8_3': child(10, 'Cardigan and jeans with boots'),
}

if __name__ == '__main__':
    bfl.PROMPTS.update(PROMPTS)   # bfl.build reads its module-level PROMPTS
    a = sys.argv[1:]
    if a[0] == 'dry':
        for name, p in PROMPTS.items():
            g = bfl.build(bfl.load(name), 'tpl_turbo')
            print(name, 'ok', len(g), 'nodes |', p, '\n')
        sys.exit(0)
    seeds = [int(s) for s in a[a.index('--seeds') + 1].split(',')]
    ok = True
    for name in a[1:a.index('--seeds')]:
        ok &= scribble3.main(a[0], [name], seeds, ['tpl_turbo'], lambda _g, v, n=name: bfl.build(bfl.load(n), v), '')
    sys.exit(0 if ok else 1)
