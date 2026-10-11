"""MPI-1041 F1 part 5: an age NEAR the sheet's own, round 2. Round 1 (qf1b): every absolute wording took Ava (reads ~40-45)
at 50 to ~70; the plain "be a 70-year-old" (n1) held the fisher (reads 80, really ~70). Here: RELATIVE wordings.
usage: qf1e.py <out_dir>. Under gpu_lease only.
"""
import json, os, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'

R1 = 'Make the character in this character sheet {d} years {dir}, with the same hairstyle and hair color.' + L1
R2 = ('Change the character in this character sheet to look {age} years old, only a little {dir} than now, with the '
      'same hairstyle and hair color.' + L1)
CASES = []
for seed in (42, 7):
    CASES.append((f'r1_age50_photo_s{seed}', 'photo', R1.format(d=10, dir='older'), seed))
    CASES.append((f'r2_age50_photo_s{seed}', 'photo', R2.format(age=50, dir='older'), seed))
    CASES.append((f'r1_age60_photo_s{seed}', 'photo', R1.format(d=20, dir='older'), seed))
    CASES.append((f'r2_age35_photo_s{seed}', 'photo', R2.format(age=35, dir='younger'), seed))


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
