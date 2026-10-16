"""MPI-1086 round 45: LOCALISED face edits (Fabio 2026-10-16). SAM3 "face" on the sheet -> a square box round the front
figure's face and one round the close-up's face -> both crops side by side on ONE canvas (1448 x 724, ~1 MP: one pass,
the same makeup on both) -> the edit -> each half pasted back through its own face mask (grown + feathered). Crop and
stitch are done here in Python; the graph version would use MpiMaskSquareBbox / MpiBoxCrop. Back view: no face, untouched.
  mk_*   Makeup from a picture: r42's mannequin as image 2 + r42's describer words (the shipped route's inputs)
  tw_*   face tattoos in words, no picture
  tp_*   face tattoos from a picture (imported_023): a Klein TATTOO mannequin (made here) + describer words
  x Q (the editor's Qwen graph fed the canvas) and K (the Klein editor graph, lock 0, fed the canvas)
  base_* the same M spider edit on the WHOLE sheet, edit only, for the time comparison
usage: qh45.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import copy, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh12
import qh26
from qh26 import run, KLEIN, QWEN, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh31 import PIC
from qh39 import SHEET_M

qh26.URL = qh12.URL = 'http://127.0.0.1:48188'
R42 = 'C:/Users/Fabio/AppData/Local/Temp/claude/c--AI-Mpi-Cubric-Vision/ada2b38e-1836-4b40-bc04-d39c837b97f4/scratchpad/r42'
SHEETS = {'M': (SHEET_M, 'flowCSFI_011.png'), 'W': (SHEET, 'flowCSE_044.png')}
HALF = 724
OWN = ("Keep each face's own shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as they are; ")
TWICE = 'Image 1 shows the same person\'s face twice. '
TAT_MANN = ('Replace the head of the person with a plain bald mannequin head, and keep only the tattoos on the face and '
            'head, exactly as they are: the same designs, colours and places. No hair, no makeup, no jewellery and no '
            'clothes, on a plain grey background.')
ASKT = ('Describe only the tattoos on the face and head in this picture: each design, its colour and where it is on the '
        'face or head. Answer with one phrase, and nothing else.')
TW = 'a small black teardrop tattoo under the left eye, and thin black tribal lines across the right temple and cheekbone'


def mk(w):
    return f'{TWICE}Apply the makeup from image 2 onto both faces in image 1: {w}. {OWN}only the makeup changes. {KEEP}'


def tw(w):
    return f'{TWICE}Add these face tattoos to both faces, in the same place on each: {w}. {OWN}only the tattoos are added. {KEEP}'


def tp(w):
    return (f'{TWICE}Copy the face tattoos from image 2 onto both faces in image 1, the same designs in the same place on '
            f'the face: {w}. Add no other tattoos and no makeup. {OWN}only the tattoos are added. {KEEP}')


PANELS = ((0, 0.30), (0.50, 1.0))   # front figure (left 30%), close-up (right half): SAM3 per panel, as the editor does


def face_mask(out, s, j):
    """SAM3 "face" on one panel crop (the editor graphs' own SAM3 loader + vocabulary), as a sheet-sized mask."""
    p = f'{out}/h45_mask_{s}{j}.png'
    sheet = Image.open(MEDIA + SHEETS[s][1]).convert('RGB')
    W, H = sheet.size
    x0, x1 = int(W * PANELS[j][0]), int(W * PANELS[j][1])
    if not os.path.exists(p):
        name = f'mpi1086_r45_panel_{s}{j}.png'
        sheet.crop((x0, 0, x1, H)).save(f'{out}/{name}')
        upload(f'{out}/{name}', name)
        g = {'1': {'class_type': 'MpiLoadImage', 'inputs': {'image': 'None', 'channel': 'alpha', 'block_if_empty': True,
                                                            'string': name}, '_meta': {'title': 'Input_Image'}},
             '2': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': 'sam3.1_multiplex_fp16.safetensors'},
                   '_meta': {'title': 'SAM3'}},
             '3': {'class_type': 'CLIPTextEncode', 'inputs': {'text': 'face', 'clip': ['2', 1]}, '_meta': {'title': 'v'}},
             '4': {'class_type': 'SAM3_Detect', 'inputs': {'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False,
                                                           'model': ['2', 0], 'image': ['1', 0], 'conditioning': ['3', 0]},
                   '_meta': {'title': 'face'}},
             '5': {'class_type': 'MaskToImage', 'inputs': {'mask': ['4', 0]}, '_meta': {'title': 'm2i'}},
             '6': {'class_type': 'PreviewImage', 'inputs': {'images': ['5', 0]}, '_meta': {'title': 'Output_Image'}}}
        api = f'{out}/h45_mask_api.json'
        json.dump(g, open(api, 'w', encoding='utf-8'))
        run(out, f'h45_mask_{s}{j}', api, {})
        os.replace(f'{out}/h45_mask_{s}{j}_Output_Image.png', p)
    m = np.zeros((H, W), bool)
    m[:, x0:x1] = np.asarray(Image.open(p).convert('L')) > 127
    return m


def box(mask):
    """The biggest face blob as a padded square box (the face + half a face all round), and its own mask."""
    lab, n = ndimage.label(mask)
    i = int(np.argmax(ndimage.sum(mask, lab, range(1, n + 1)))) + 1
    ys, xs = ndimage.find_objects(lab)[i - 1]
    H, W = mask.shape
    cx, cy = (xs.start + xs.stop) / 2, (ys.start + ys.stop) / 2
    side = int(max(xs.stop - xs.start, ys.stop - ys.start) * 2)
    x0 = int(min(max(cx - side / 2, 0), W - side))
    y0 = int(min(max(cy - side / 2, 0), H - side))
    return (x0, y0, x0 + side, y0 + side), lab == i


def canvas(out, s):
    sheet = Image.open(MEDIA + SHEETS[s][1]).convert('RGB')
    bx = [box(face_mask(out, s, j)) for j in range(2)]
    c = Image.new('RGB', (HALF * 2, HALF))
    for j, (b, _m) in enumerate(bx):
        c.paste(sheet.crop(b).resize((HALF, HALF), Image.LANCZOS), (HALF * j, 0))
    name = f'mpi1086_r45_canvas_{s}.png'
    c.save(f'{out}/{name}')
    upload(f'{out}/{name}', name)
    return sheet, bx, name


def stitch(sheet, bx, edit):
    res = sheet.copy()
    e = Image.open(edit).convert('RGB').resize((HALF * 2, HALF), Image.LANCZOS)
    for j, (b, m) in enumerate(bx):
        side = b[2] - b[0]
        grow = max(2, side // 25)
        mm = ndimage.binary_dilation(m, iterations=grow)[b[1]:b[3], b[0]:b[2]]
        alpha = Image.fromarray((mm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(grow))
        res.paste(e.crop((HALF * j, 0, HALF * (j + 1), HALF)).resize((side, side), Image.LANCZOS), b[:2], alpha)
    return res


def edit(out, tag, model, canvas_name, text, seed, ref):
    q = {'Input_Image': {'string': canvas_name}, 'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
         'Input_Reference': {'boolean': bool(ref)}, 'Input_Headless': {'boolean': False}}
    if ref:
        q['Input_Image_2'] = {'string': ref}
    if model == 'Q':
        run(out, tag, QWEN, {**q, 'Input_Is_Mannequin': {'boolean': True}, 'Input_Back_Pass': {'boolean': False}})
        return f'{out}/{tag}_Output_Image_2.png'
    run(out, tag, KLEIN, {**q, 'Input_Lock': {'int': 0}})
    return f'{out}/{tag}_Output_Image.png'


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    for s, (name, src) in SHEETS.items():
        upload(MEDIA + src, name)
    desc = json.load(open(f'{R42}/h42_describe.json', encoding='utf-8'))
    for k in ('m_spider', 'm_glam', 'm_goth'):
        upload(f'{R42}/h42_M_{k}_Output_Image.png', f'mpi1086_r45_mann_{k}.png')
    # the tattoo mannequin + its words, made once
    upload(MEDIA + PIC['t_all'][1], 'mpi1086_r45_t_all.png')
    tm = f'{out}/h45_tmann_Output_Image.png'
    if not os.path.exists(tm):
        run(out, 'h45_tmann', KLEIN, {'Input_Image': {'string': 'mpi1086_r45_t_all.png'}, 'Input_Seed': {'int': 735724985},
                                      'Input_Positive': {'string': TAT_MANN}, 'Input_Lock': {'int': 0},
                                      'Input_Reference': {'boolean': False}, 'Input_Headless': {'boolean': False}})
    upload(tm, 'mpi1086_r45_tmann.png')
    dpath = f'{out}/h45_describe.json'
    d45 = json.load(open(dpath, encoding='utf-8')) if os.path.exists(dpath) else {}
    if 't_all' not in d45:
        d45['t_all'] = qh12.describe('mpi1086_r45_t_all.png', ASKT)
        json.dump(d45, open(dpath, 'w', encoding='utf-8'), indent=1)
    print('t_all ->', d45['t_all'], flush=True)
    w = lambda t: t.strip().rstrip('.')
    cases = []   # (tag, sheet, text, seed, ref)
    for s, k in (('M', 'm_spider'), ('M', 'm_glam'), ('M', 'm_goth'), ('W', 'm_spider')):
        cases.append((f'mk_{s}_{k}', s, mk(w(desc[k])), PIC[k][2], f'mpi1086_r45_mann_{k}.png'))
    for s in 'MW':
        cases.append((f'tw_{s}', s, tw(TW), 45001, None))
        cases.append((f'tp_{s}', s, tp(w(d45['t_all'])), 45002, 'mpi1086_r45_tmann.png'))
    cv = {s: canvas(out, s) for s in SHEETS}
    for model in 'QK':
        for i, (tag, s, text, seed, ref) in enumerate(cases):
            t = f'h45_{model}_{tag}'
            if (only and not any(t.startswith(o) for o in only)) or os.path.exists(f'{out}/{t}_stitched.png'):
                continue
            if i == 0:   # warm-up: the first run of a model pays the load; time the second
                edit(out, t + '_warm', model, cv[s][2], text, seed, ref)
            sheet, bx, cname = cv[s]
            stitch(sheet, bx, edit(out, t, model, cname, text, seed, ref)).save(f'{out}/{t}_stitched.png')
    # the whole-sheet edit, same inputs, for the time comparison (warm by now)
    k = 'm_spider'
    for model in 'QK':
        t = f'h45_base_{model}'
        if (only and not any(t.startswith(o) for o in only)) or os.path.exists(f'{out}/{t}_done'):
            continue
        q = {'Input_Image': {'string': SHEET_M}, 'Input_Seed': {'int': PIC[k][2]}, 'Input_Headless': {'boolean': False},
             'Input_Positive': {'string': mk(w(desc[k])).replace(TWICE, '').replace('both faces in image 1', 'the face of the character in image 1')},
             'Input_Reference': {'boolean': True}, 'Input_Image_2': {'string': f'mpi1086_r45_mann_{k}.png'}}
        if model == 'Q':
            run(out, t, QWEN, {**q, 'Input_Is_Mannequin': {'boolean': True}, 'Input_Back_Pass': {'boolean': False}})
        else:
            run(out, t, KLEIN, {**q, 'Input_Lock': {'int': 0}})
        open(f'{out}/{t}_done', 'w').close()
