"""MPI-1041 F1 part 6: Accessories round 2. Round 1: shipped a0 missed a panel on 2 of 4; naming "the back view" (a1, a2)
drew an EXTRA back figure on 3 of 4; a match pass (qf1d) changed nothing. usage: qf1f.py <out_dir>. Under gpu_lease only.
"""
import json, os, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
KEEP = 'Keep everything else exactly as it is.'
ACC = 'a red scarf and round glasses'
A3 = f'Give the character {ACC}, worn the same way on all three figures in this character sheet. ' + KEEP
A4 = (f'Give the character {ACC}. Make the same change on the character seen from behind and in the close-up portrait '
      'on the right. ' + KEEP)
CASES = [(f'{k}_acc_{sh}_s{seed}', sh, p, seed) for seed in (42, 7) for sh in SHEETS for k, p in (('a3', A3), ('a4', A4))]


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
