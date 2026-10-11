"""MPI-1041 F1 part 8: Accessories round 3 - a4 (round 2's winner, 3/4, layout kept 4/4) vs shipped a0 on two more seeds,
plus a4 on a hat (a head item: must not break the layout or regrow the beanie). usage: qf1h.py <out>. Lease only.
"""
import json, os, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
KEEP = 'Keep everything else exactly as it is.'
L1 = ' Make the same change in the close-up portrait on the right. ' + KEEP


def a0(w):
    return f'Give the character {w}.' + L1


def a4(w):
    return (f'Give the character {w}. Make the same change on the character seen from behind and in the close-up portrait '
            'on the right. ' + KEEP)


ACC = 'a red scarf and round glasses'
HAT = 'a black wide-brimmed hat'
CASES = [(f'{k}_acc_{sh}_s{seed}', sh, f(ACC), seed) for seed in (3, 11) for sh in SHEETS for k, f in (('a0', a0), ('a4', a4))]
CASES += [(f'a4_hat_{sh}_s42', sh, a4(HAT), 42) for sh in SHEETS]


def main():
    out = sys.argv[1]
    for tag, sh, prompt, seed in CASES:
        if os.path.exists(f'{out}/{tag}.png'):
            continue
        spec = [{'tag': tag, 'api': API, 'set': {'Input_Image': {'string': SHEETS[sh]}, 'Input_Positive': {'string': prompt},
                                                 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 0}}}]
        sp = f'{out}/spec_{tag}.json'
        json.dump(spec, open(sp, 'w', encoding='utf-8'), indent=1)
        if subprocess.run([sys.executable, RUN_API, out, sp]).returncode:
            print('CASE FAILED', tag, flush=True)


if __name__ == '__main__':
    main()
