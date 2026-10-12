"""MPI-1086 phase B round 3: Fabio's seven Pinterest hairstyle pictures (Qwen 2.1/Media/imported_005-011, staged as
mpi1086_pin<N>.png) with the round-2 winning string, no words. All seven on Fabio's sheet (flowCSFI_002); the two men's
cuts (006 curly fade, 009 textured fade) also on the fisherman sheet (MPI-1041's mpi1042art_fisher_sheet.png).
usage: qh9.py <out> <R1|R2> [only...]. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qh8

PINS = {5: 'pink buns', 6: 'curly fade (man)', 7: 'braids', 8: 'pigtails + fringe', 9: 'textured fade (man)',
        10: 'puff buns (boy)', 11: 'black fringe + updo'}
FISHER = 'mpi1042art_fisher_sheet.png'

if __name__ == '__main__':
    out, name = sys.argv[1], sys.argv[2]
    only = sys.argv[3:]
    prompt = getattr(qh8, name)
    qh1.stage()
    api = qh2.graph(out, 'B3')
    cs = [(f'h9_{name}_p{n}_{t}', qh1.SHEET, n, seed) for n in PINS for t, seed in qh1.SEEDS[1:]]
    cs += [(f'h9_{name}_p{n}_fisher_s42', FISHER, n, 42) for n in (6, 9)]
    for tag, sheet, n, seed in cs:
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, PINS[n], flush=True)
        qh1.qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': sheet}, 'Input_Image_2': {'string': f'mpi1086_pin{n}.png'},
            'Input_Reference': {'boolean': True}, 'Input_Positive': {'string': prompt},
            'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 2}}}], tag)
