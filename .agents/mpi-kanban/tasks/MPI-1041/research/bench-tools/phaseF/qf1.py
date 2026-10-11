"""MPI-1041 F1: panel agreement for Clothes + Accessories on the APP graph (comfy_workflows/flow_character_sheet_edit.json).
usage: qf1.py <out_dir> [only_prefix,...]   - writes one spec per case, runs each through run_api.py (:8188). Run ONLY under gpu_lease.
Sheets: fabio = his headless bikini sheet (detail_002, the failed keyhole run), photo, fisher (bench sheets).
"""
import json, os, shutil, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
IN = 'G:/ComfyUi/ComfyUI/input'
FABIO_SRC = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media/detail_002.png'
SHEETS = {'fabio': 'mpi1041f1_fabio_sheet.png', 'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
KEEP = 'Keep everything else exactly as it is.'
L1 = ' Make the same change in the close-up portrait on the right. ' + KEEP

DRESS = 'Beautiful red dress with a keyhole and long skirt'


def c0(w):   # shipped Clothes wording
    return f'Dress the character in {w}. Dress the character the same way in the close-up portrait on the right. ' + KEEP


def c1(w):   # every view named, the parts that disagreed named
    return (f'Dress the character in {w}. The front view, the back view and the close-up portrait on the right all show '
            'the same outfit, with the same neckline, sleeves and straps. ' + KEEP)


def c2(w):   # replace the old clothes everywhere (the halter came from the bikini string)
    return (f'Replace all of the character\'s clothes with {w}, in the front view, the back view and the close-up '
            'portrait on the right, with the same neckline, sleeves and straps in every view. ' + KEEP)


def a0(w):   # shipped Accessories wording
    return f'Give the character {w}.' + L1


def a1(w):
    return (f'Give the character {w}. The front view, the back view and the close-up portrait on the right all show '
            f'{w} wherever they would be seen. ' + KEEP)


def a2(w):
    return (f'Give the character {w} in the front view, in the back view and in the close-up portrait on the right. '
            + KEEP)


CASES = []   # (tag, sheet, lock, prompt, seed)
for seed in (42, 7, 1497140120):
    for k, f in (('c0', c0), ('c1', c1), ('c2', c2)):
        CASES.append((f'{k}_dress_fabio_s{seed}', 'fabio', 1, f(DRESS), seed))
# round 2: c1 won 3/3 on fabio (c0 2/3, c2 2/3) - more seeds, and the bench sheets' outfits (c0 passed them in A2)
for seed in (3, 11):
    for k, f in (('c0', c0), ('c1', c1)):
        CASES.append((f'{k}_dress_fabio_s{seed}', 'fabio', 1, f(DRESS), seed))
JACKET = 'a red leather jacket, black jeans and boots'
for seed in (42, 7):
    for sh in ('photo', 'fisher'):
        CASES.append((f'c1_jacket_{sh}_s{seed}', sh, 1, c1(JACKET), seed))
ACC = 'a red scarf and round glasses'
for seed in (42, 7):
    for sh in ('photo', 'fisher'):
        for k, f in (('a0', a0), ('a1', a1), ('a2', a2)):
            CASES.append((f'{k}_acc_{sh}_s{seed}', sh, 0, f(ACC), seed))


def main():
    out = sys.argv[1]
    only = [x for x in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if x]
    os.makedirs(out, exist_ok=True)
    if not os.path.exists(f'{IN}/{SHEETS["fabio"]}'):
        shutil.copy(FABIO_SRC, f'{IN}/{SHEETS["fabio"]}')
    for tag, sh, lock, prompt, seed in CASES:
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        spec = [{'tag': tag, 'api': API, 'set': {'Input_Image': {'string': SHEETS[sh]}, 'Input_Positive': {'string': prompt},
                                                 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': lock}}}]
        p = f'{out}/spec_{tag}.json'
        json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
        r = subprocess.run([sys.executable, RUN_API, out, p])
        if r.returncode:
            print('CASE FAILED', tag, flush=True)
    json.dump([{'tag': t, 'sheet': s, 'lock': l, 'prompt': p, 'seed': sd} for t, s, l, p, sd in CASES],
              open(f'{out}/cases.json', 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
