"""MPI-1041 F1 part 7: an age near the sheet's own, round 3 - name the SIGNS of the age, not only the number.
Round 1 (absolute) overshot Ava 50 to ~70; round 2 (relative "N years older") barely moved her. usage: qf1g.py <out>. Lease only.
"""
import json, os, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
S50 = ('Change the character in this character sheet to look 50 years old: a few fine lines around the eyes and mouth, '
       'otherwise the same face, hairstyle and hair color.' + L1)
S60 = ('Change the character in this character sheet to look 60 years old: wrinkles around the eyes and mouth and some '
       'grey in the hair, otherwise the same face and hairstyle.' + L1)
N1H = 'Change the character in this character sheet to be a 50-year-old, with the same hairstyle and hair color.' + L1
CASES = [(f'{k}_photo_s{seed}', p, seed) for seed in (42, 7) for k, p in (('s50', S50), ('s60', S60), ('n1h50', N1H))]


def main():
    out = sys.argv[1]
    for tag, prompt, seed in CASES:
        if os.path.exists(f'{out}/{tag}.png'):
            continue
        spec = [{'tag': tag, 'api': API, 'set': {'Input_Image': {'string': 'mpi1042art_cafe2_sheet.png'},
                                                 'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed},
                                                 'Input_Lock': {'int': 0}}}]
        sp = f'{out}/spec_{tag}.json'
        json.dump(spec, open(sp, 'w', encoding='utf-8'), indent=1)
        if subprocess.run([sys.executable, RUN_API, out, sp]).returncode:
            print('CASE FAILED', tag, flush=True)


if __name__ == '__main__':
    main()
