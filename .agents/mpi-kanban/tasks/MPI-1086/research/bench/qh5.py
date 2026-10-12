"""MPI-1086 phase C: an Accessory from a Reference picture. Accessories is a FREE edit (lock 0): a head lock blocks
glasses and hats (MPI-1041 A4). F2 rounds 1-2: a hat from a picture 1/4, so this is the risky change.
Refs (Klein t2i on the bench, seed 42): backpack + earrings = product shots (no person); bandana + tattoo = worn by a
person (the photo case a user finds online).
  AN - no words: "the accessory from the reference picture" + the shipped accessories tail (back "seen from behind")
  AW - words name it, the shipped accessories string with "from the reference picture" added
Sheet = Fabio's flowCSFI_002 (graph = the B3 brow-cut graph; lock 0 never reads the cut). Seeds s42 / s7.
usage: qh5.py <out> [only...]. Under gpu_lease only.
"""
import os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qf2

REFS = {
    'backpack': ('A product photo of a brown leather backpack with brass buckles, front view, plain white background, '
                 'studio lighting.', 'the brown leather backpack'),
    'earrings': ('A product photo of a pair of large gold hoop earrings, plain white background, studio lighting.',
                 'the large gold hoop earrings'),
    'bandana': ('A photo of a young man wearing a red paisley bandana tied over his forehead, head and shoulders, plain '
                'grey background.', 'the red paisley bandana tied over the forehead'),
    'tattoo': ('A close-up photo of a forearm with a black ink tattoo of a rose with thorns, plain background.',
               'the black rose tattoo on the forearm'),
}
TAIL = ' Make the same change on the character seen from behind and in the close-up portrait on the right. ' \
       'Keep everything else exactly as it is.'


def ref_name(k):
    return f'mpi1086_ref_{k}.png'


def make_refs(out):
    for k, (prompt, _) in REFS.items():
        name = ref_name(k)[:-4]
        if os.path.exists(f'{qf2.IN}/{name}.png'):
            continue
        qf2.run(out, [{'tag': name, 'api': qf2.KLEIN_API, 'set': {
            'Input_wf_type': {'int': 1}, 'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': 42},
            'Input_Image': {'block_if_empty': False}}}], name)
        if os.path.exists(f'{out}/{name}.png'):
            shutil.copy(f'{out}/{name}.png', f'{qf2.IN}/{name}.png')


def cases():
    c = []
    for k, (_, words) in REFS.items():
        for name, prompt in (('AN', 'Give the character the accessory from the reference picture.' + TAIL),
                             ('AW', f'Give the character {words} from the reference picture.' + TAIL)):
            for t, seed in qh1.SEEDS[1:]:
                c.append((f'h5_{name}_{k}_{t}', prompt, seed, ref_name(k)))
    return c


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    make_refs(out)
    api = qh2.graph(out, 'B3')
    for tag, prompt, seed, ref in cases():
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh1.SHEET}, 'Input_Image_2': {'string': ref}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 0}}}], tag)
