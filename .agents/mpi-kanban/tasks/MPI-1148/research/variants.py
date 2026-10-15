"""MPI-1148 bench: Klein pass-1 variants of flow_character_sheet_from_images_klein.json.

python variants.py <outdir>  -> <outdir>/{A,B,C,D}.json (API graphs) + spec.json for
MPI-1042's run_api.py. Run that under gpu_lease.py.

A  as shipped: pass 1 sees the body as ref 2, the framing sentence comes AFTER the user's words.
B  framing first + an explicit chest crop (body ref kept).
C  pass 1 without the body ref; the portrait prompt is the no-body one (the clothes caption still
   rides in the user text).
D  B + C.
"""
import copy, json, os, sys

SRC = os.path.join(os.path.dirname(__file__), '../../../../../comfy_workflows/flow_character_sheet_from_images_klein.json')
CROP = 'Framed from just above the head down to mid-chest; the arms below the shoulders, the hands, legs and feet are outside the frame. '
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
base = json.load(open(SRC, encoding='utf-8'))
# Node ids of the shipped graph: 52/53 portrait prompt no-body/with-body, 54 its select, 55/56 copy/turn
# framing, 58 their concat, 70/71 pass-1 refs (face / + body), 72 pass-1 conditioning select.
assert base['58']['_meta']['title'] == 'Concatenate Text' and base['72']['_meta']['title'].startswith('Pass1_Conditioning')


def framing_first(g):
    g['58']['inputs'].update({'string_a': ['57', 0], 'string_b': ['54', 0]})
    for k in ('55', '56'):
        v = g[k]['inputs']['value']
        g[k]['inputs']['value'] = v.replace('Plain smooth grey', CROP + 'Plain smooth grey', 1)


def no_body_ref(g):
    g['72']['inputs']['true'] = ['70', 0]
    g['54']['inputs']['true'] = ['52', 0]


TAIL = ' The picture is a close-up: only the head, neck and the top of the shoulders are in frame, nothing below the chest.'


def framing_last(g):
    # After the user's words, which (round 1) pulled the portrait out to a full body on "Army boots".
    for k in ('52', '53'):
        g[k]['inputs']['value'] += TAIL


def no_user_words(g):
    # Pass 1 gets the clothes caption only (#25), not the caption + the user's words (#27).
    g['59']['inputs']['replace'] = ['25', 0]


ROUND = sys.argv[2] if len(sys.argv) > 2 else '1'
variants = {
    '1': {'A': [], 'B': [framing_first], 'C': [no_body_ref], 'D': [framing_first, no_body_ref]},
    '2': {'D': [framing_first, no_body_ref], 'E': [framing_first, no_body_ref, framing_last],
          'F': [framing_first, no_body_ref, no_user_words]},
    # Round 1: framing-first (B, D) did worse than C alone - D's no-words portrait went waist-up.
    '3': {'C': [no_body_ref], 'G': [no_body_ref, no_user_words], 'H': [no_body_ref, framing_last]},
    # Regression: shipped vs the round-2/3 pick on MPI-1042's pictures (clothes caption, nude, no body).
    '4': {'A': [], 'H': [no_body_ref, framing_last]},
}[ROUND]
for name, fns in variants.items():
    g = copy.deepcopy(base)
    for f in fns:
        f(g)
    json.dump(g, open(os.path.join(out, name + '.json'), 'w', encoding='utf-8'), indent=1)

CASES = [  # Fabio's two Klein runs (Qwen 2.1 project, flowCSFI_009 / _010) + no words
    ('arms', 3034548662, 'Freakishly large arms, Army boots'),
    ('boots', 452508749, 'Army boots'),
    ('plain', 42, ''),
] if ROUND == '1' else [
    ('arms', 3034548662, 'Freakishly large arms, Army boots'),
    ('boots', 452508749, 'Army boots'),
    ('hair', 42, 'A short buzz cut, Army boots'),  # a haircut must still reach the portrait
]
FIXED = {
    'Input_Image': {'image': 'mpi1148_face.jpg'},
    'Input_Image_2': {'image': 'mpi1148_body.jpg'},
    'Input_Box': {'x': 38, 'y': 37, 'width': 614, 'height': 768},
    'Input_Face_Pose': {'string': 'TURNED'},
    'Input_Body_Clothes': {'string': 'a grey t-shirt and black sweatpants'},
}
NO_BOX = {'x': 0, 'y': 0, 'width': 0, 'height': 0}  # MPI-1042's crops are already 4:5
PHONE = {'Input_Image': {'image': 'mpi1042_phone_4x5.png'}, 'Input_Box': NO_BOX, 'Input_Face_Pose': {'string': 'FRONT'}}
REGRESSION = [  # (tag, seed, text, overrides) - batch 22/23 cases, MPI-1042 validation.md
    ('PF42', 42, '', {**PHONE, 'Input_Image_2': {'image': '49cf8c25b4fa85adadb44600e456fd41.jpg'},
                      'Input_Body_Clothes': {'string': 'a white tank top and gray jeans'}}),
    ('PF7', 7, '', {**PHONE, 'Input_Image_2': {'image': '49cf8c25b4fa85adadb44600e456fd41.jpg'},
                    'Input_Body_Clothes': {'string': 'a white tank top and gray jeans'}}),
    ('PN42', 42, '', {**PHONE, 'Input_Image_2': {'image': 'Sheet for Dataset Maker V2 Pt.png'},
                      'Input_Body_Clothes': {'string': 'no clothing'}}),
    ('man', 42, '', {'Input_Image': {'image': 'mpi1042_threequarter_4x5.png'}, 'Input_Box': NO_BOX,
                     'Input_Image_2': {'image': 'None'}, 'Input_Face_Pose': {'string': 'TURNED'},
                     'Input_Body_Clothes': {'string': ''}}),
    ('front', 42, '', {'Input_Image': {'image': 'mpi1042_front_4x5.png'}, 'Input_Box': NO_BOX,
                       'Input_Image_2': {'image': 'None'}, 'Input_Face_Pose': {'string': 'FRONT'},
                       'Input_Body_Clothes': {'string': ''}}),
]
spec = []
for name in variants:
    for tag, seed, text, *over in (REGRESSION if ROUND == '4' else CASES):
        if ROUND in ('2', '3') and name in ('C', 'D') and tag != 'hair':
            continue  # their arms / boots runs are round 1's
        s = copy.deepcopy(FIXED)
        s.update(copy.deepcopy(over[0]) if over else {})
        s['Input_Seed'] = {'int': seed}
        s['Input_Positive'] = {'string': text}
        spec.append({'tag': f'{name}_{tag}', 'api': os.path.abspath(os.path.join(out, name + '.json')), 'set': s})
json.dump(spec, open(os.path.join(out, 'spec.json'), 'w', encoding='utf-8'), indent=1)
print(len(spec), 'runs ->', out)
