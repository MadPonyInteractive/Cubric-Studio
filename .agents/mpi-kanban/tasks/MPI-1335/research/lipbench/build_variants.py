# MPI-1335 step 2b: the four lip-bench graphs, patched from the SHIPPED flow_video_edit.json.
#   V1 as shipped | V2 soundtrack into H3 | V3 swap LoRA on | V4 both
# Bench only: the shipped graph changes through the bench builder (video-edit.md § Traps), not this.
#   python build_variants.py   -> writes V1..V4 json next to this file
import copy, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'flow_video_edit.json')
base = json.load(open(SRC, encoding='utf-8'))


def soundtrack(w):
    # Silence for the still lead-in (node 36 frames, 17 on template 6), then the grid-cut clip audio (node 35),
    # so the speech lands on the frames it belongs to. EmptyAudio at 0 s is never hit here: the bench is template 6.
    w['300'] = {'class_type': 'MpiMath', '_meta': {'title': 'Lead-in seconds'},
                'inputs': {'math_expression': 'a / b', 'a': ['36', 0], 'b': ['10', 2]}}
    w['301'] = {'class_type': 'EmptyAudio', '_meta': {'title': 'Lead-in silence'},
                'inputs': {'sample_rate': 44100, 'channels': 2, 'duration': ['300', 0]}}  # MpiMath has ONE output
    w['302'] = {'class_type': 'AudioConcat', '_meta': {'title': 'Silence + clip audio'},
                'inputs': {'direction': 'after', 'audio1': ['301', 0], 'audio2': ['35', 0]}}
    # No lead-in (masked route, the video's room): the clip audio as is. Lazy MpiIfElse, so a 0 s EmptyAudio never runs.
    w['303'] = {'class_type': 'MpiIfElse', '_meta': {'title': 'lead-in ? silence + clip audio : clip audio'},
                'inputs': {'true': ['302', 0], 'false': ['35', 0], 'boolean': ['45', 0]}}
    for node in ('110', '223'):
        w[node]['inputs']['ref_video_audio_1'] = ['303', 0]


def lora_on(w):
    w['21']['inputs']['math_expression'] = '(a + (b == 1) * c + 1) > 0'


def pin_seed(w):
    # The app writes a random seed into the MpiInt titled Input_Seed on every Flow run and ignores a submit's
    # `seed`, so a renamed node keeps it fixed. 3362804242 = the seed V1_shipped ran on (flowVideoEdit_001).
    w['17']['_meta']['title'] = 'Bench_Seed'
    w['17']['inputs']['int'] = 3362804242


def blend(px):
    # Masked-route seam bench (plan.md § Masked route seam): InpaintCropImproved's blend, 24 px as shipped.
    def patch(w):
        w['54']['inputs']['mask_blend_pixels'] = px
    return patch


VARIANTS = {'V1_shipped': [], 'V2_soundtrack': [soundtrack], 'V3_lora': [lora_on], 'V4_both': [soundtrack, lora_on],
            'B64_blend': [soundtrack, blend(64)], 'B96_blend': [soundtrack, blend(96)]}
for name, patches in VARIANTS.items():
    w = copy.deepcopy(base)
    for p in patches + ([pin_seed] if patches else []):  # V1 stays byte-identical: it is also the restore copy
        p(w)
    with open(os.path.join(HERE, name + '.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(w, f, indent=2)
        f.write('\n')
    print(name, len(w), 'nodes')
