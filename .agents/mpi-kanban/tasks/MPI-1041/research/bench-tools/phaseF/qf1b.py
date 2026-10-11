"""MPI-1041 F1 part 2: Hairstyle under a hat (fisher beanie) and an age NEAR the sheet's own (overshoot), on the app graph.
usage: qf1b.py <out_dir> [only_prefix,...]   Run ONLY under gpu_lease (run_qf1.sh-style wrapper).
"""
import json, os, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
KEEP = 'Keep everything else exactly as it is.'
L1 = ' Make the same change in the close-up portrait on the right. ' + KEEP
BOB = 'a short black bob'


def h0(w):   # shipped Hairstyle wording
    return f'Give the character {w}.' + L1


def h1(w):   # a hat hides the hair: take it off
    return f'Give the character {w}, with the head uncovered and no hat, so the new hair shows.' + L1


def n0(age, older):   # shipped: older -> plain; younger (>= 40) -> "with a younger face"
    head = (f'Change the character in this character sheet to be {"an older" if older else "a younger"} '
            f'version of themselves as a {age}-year-old')
    return head + ('.' if older else ', with a younger face.') + L1


def n1(age, older):   # no direction word
    return f'Change the character in this character sheet to be a {age}-year-old.' + L1


def n3(age, older):   # no direction, the change kept small
    return (f'Make the character in this character sheet look {age} years old, changing only the signs of age and '
            'only as much as that needs.' + L1)


CASES = []   # (tag, sheet, lock, prompt, seed)
for seed in (42, 7):
    for k, f in (('h0', h0), ('h1', h1)):
        CASES.append((f'{k}_bob_fisher_s{seed}', 'fisher', 2, f(BOB), seed))
CASES.append(('h1_bob_photo_s42', 'photo', 2, h1(BOB), 42))
# photo reads ~40-45 -> 50 is older; fisher reads ~80 -> 70 is younger
for seed in (42, 7):
    for k, f in (('n0', n0), ('n1', n1), ('n3', n3)):
        CASES.append((f'{k}_age50_photo_s{seed}', 'photo', 0, f(50, True), seed))
        CASES.append((f'{k}_age70_fisher_s{seed}', 'fisher', 0, f(70, False), seed))


def main():
    out = sys.argv[1]
    only = [x for x in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if x]
    os.makedirs(out, exist_ok=True)
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
        if subprocess.run([sys.executable, RUN_API, out, p]).returncode:
            print('CASE FAILED', tag, flush=True)
    json.dump([{'tag': t, 'sheet': s, 'lock': l, 'prompt': p, 'seed': sd} for t, s, l, p, sd in CASES],
              open(f'{out}/cases_b.json', 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
