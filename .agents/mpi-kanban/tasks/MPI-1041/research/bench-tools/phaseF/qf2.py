"""MPI-1041 F2 bench: an optional REFERENCE picture (outfit / accessory / hairstyle) as a second Klein reference latent.
usage: qf2.py refs <out_dir>         make the reference pictures with Klein t2i (bench graph klein9b_edit_api.json)
       qf2.py edit <out_dir> [only]  the app graph + a second ReferenceLatent fed by Input_Image_2 (bench copy, never the app file)
Run ONLY under gpu_lease.
"""
import copy, json, os, shutil, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
KLEIN_API = 'G:/ComfyUi/ComfyUI/output/mpi1041_q1/klein9b_edit_api.json'
IN = 'G:/ComfyUi/ComfyUI/input'
SHEETS = {'fabio': 'mpi1041f1_fabio_sheet.png', 'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
KEEP = 'Keep everything else exactly as it is.'

REFS = {   # tag: t2i prompt (front view only, as a user's product / outfit photo would be)
    'dress': ('A product photo of a red dress with a keyhole neckline, long sleeves and a long flowing skirt, on a dress '
              'form, front view, plain light grey background, studio lighting.'),
    'jacket': ('A front-view fashion photo of a man wearing a green quilted jacket, a yellow and navy striped scarf and brown '
               'corduroy trousers, standing, plain white background.'),
    'hat': 'A product photo of a black wide-brimmed fedora hat, plain white background, studio lighting.',
    'pixie': ('A portrait photo of a woman with a platinum blonde pixie cut haircut, front view, plain grey background.'),
}


def build_ref_graph(out):
    """App graph + Input_Image_2 -> scale ~1 MP -> VAEEncode -> ReferenceLatent on top of 'Set Reference Latent 1'."""
    g = json.load(open(API, encoding='utf-8'))
    T = {v['_meta']['title']: k for k, v in g.items()}
    ref1 = T['Set Reference Latent 1']
    vae = T['Load VAE']
    users = [(k, a) for k, v in g.items() for a, b in v['inputs'].items() if b == [ref1, 0]]
    g['900'] = {'class_type': 'MpiLoadImage', '_meta': {'title': 'Input_Image_2'},
                'inputs': {'image': 'None', 'channel': 'alpha', 'block_if_empty': False, 'string': ''}}
    g['901'] = {'class_type': 'ImageScaleToTotalPixels', '_meta': {'title': 'ref 2 to 1 MP'},
                'inputs': {'upscale_method': 'nearest-exact', 'megapixels': 1.0, 'resolution_steps': 16, 'image': ['900', 0]}}
    g['902'] = {'class_type': 'VAEEncode', '_meta': {'title': 'Encode ref 2'}, 'inputs': {'pixels': ['901', 0], 'vae': [vae, 0]}}
    g['903'] = {'class_type': 'ReferenceLatent', '_meta': {'title': 'Set Reference Latent 2'},
                'inputs': {'conditioning': [ref1, 0], 'latent': ['902', 0]}}
    for k, a in users:
        g[k]['inputs'][a] = ['903', 0]
    p = os.path.join(out, 'flow_character_sheet_edit_ref2_api.json')
    json.dump(g, open(p, 'w', encoding='utf-8'), indent=1)
    print('ref2 graph rewired', users)
    return p


def clothes_ref(words=''):
    w = f' {words}' if words else ''
    return (f'Dress the character in the outfit from the reference picture{w}. Dress the character the same way in the '
            'close-up portrait on the right. ' + KEEP)


def acc_ref():
    return ('Give the character the accessory from the reference picture. Make the same change in the close-up portrait '
            'on the right. ' + KEEP)


def hair_ref():
    return ('Give the character the hairstyle and hair color from the reference picture. Make the same change in the '
            'close-up portrait on the right. ' + KEEP)


def cases():
    c = []   # (tag, sheet, lock, prompt, ref, seed)
    for seed in (42, 7):
        c.append((f'r_dress_fabio_s{seed}', 'fabio', 1, clothes_ref(), 'dress', seed))
        c.append((f'r_dress_photo_s{seed}', 'photo', 1, clothes_ref(), 'dress', seed))
        c.append((f'r_jacket_fisher_s{seed}', 'fisher', 1, clothes_ref(), 'jacket', seed))
        c.append((f'r_jacket_photo_s{seed}', 'photo', 1, clothes_ref(), 'jacket', seed))
    c.append(('r_hat_photo_s42', 'photo', 0, acc_ref(), 'hat', 42))
    c.append(('r_hat_fisher_s42', 'fisher', 0, acc_ref(), 'hat', 42))
    c.append(('r_pixie_photo_s42', 'photo', 2, hair_ref(), 'pixie', 42))
    c.append(('r_pixie_fisher_s42', 'fisher', 2, hair_ref(), 'pixie', 42))
    return c


def run(out, spec, tag):
    p = f'{out}/spec_{tag}.json'
    json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
    if subprocess.run([sys.executable, RUN_API, out, p]).returncode:
        print('CASE FAILED', tag, flush=True)


def phase_refs(out):
    for tag, prompt in REFS.items():
        name = f'mpi1041f2_ref_{tag}'
        if os.path.exists(f'{IN}/{name}.png'):
            continue
        run(out, [{'tag': name, 'api': KLEIN_API, 'set': {'Input_wf_type': {'int': 1}, 'Input_Positive': {'string': prompt},
                                                         'Input_Seed': {'int': 42}, 'Input_Image': {'block_if_empty': False}}}], name)
        if os.path.exists(f'{out}/{name}.png'):
            shutil.copy(f'{out}/{name}.png', f'{IN}/{name}.png')


def phase_edit(out, only):
    api = build_ref_graph(out)
    for tag, sh, lock, prompt, ref, seed in cases():
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': SHEETS[sh]}, 'Input_Image_2': {'string': f'mpi1041f2_ref_{ref}.png'},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': lock}}}], tag)
    json.dump([dict(zip(('tag', 'sheet', 'lock', 'prompt', 'ref', 'seed'), x)) for x in cases()],
              open(f'{out}/cases_f2.json', 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    if sys.argv[1] == 'refs':
        phase_refs(out)
    else:
        phase_edit(out, [x for x in (sys.argv[3].split(',') if len(sys.argv) > 3 else []) if x])
