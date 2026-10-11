"""MPI-1090 round 1: Fabio's black dress reference (front only) on his WITH-HEAD sheet (flowCSE_010; his own runs took
the headless one, MPI-1089). Shipped graph, Input_Reference true, lock 1.
  DN  - the shipped no-words string: is the charcoal front the headless input?
  E   - DN + "in the same colours" + the back reached the safe way ("the character seen from behind", F1 0/10 redraws)
  W0  - the shipped words string with "G string on the back view" (repro of flowCSE_012)
  Wg  - words in their OWN sentence after a whole reference clause, view name rewritten: "G string seen from behind"
  Wr  - the same shape with a no-view change, "in red"
usage: qg1.py <out>. Under gpu_lease only (MPI-1041 phaseF tools post to the bench :8188).
"""
import os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
import qf2

PROJ = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media'
SHEET, REF = 'mpi1090_sheet.png', 'mpi1090_ref_dress.jpg'
SRC = {SHEET: f'{PROJ}/flowCSE_010.png',
       REF: f'{PROJ}/.preview-assets/a551508fd11fe5cf6dfb30ab267d3194c00b0e16310c726d08f7f13f295f0e51.jpg'}

TAIL = ('Dress the character the same way in the close-up portrait on the right, with the same neckline and straps. '
        'Keep everything else exactly as it is.')
BACK = 'Dress the character seen from behind in the back of the same outfit. '
REPLACE = ', replacing all of the clothes the character wears now, top and bottom. '
DN = ('Dress the character in only the outfit from the reference picture. Take off everything else the character '
      'wears now, trousers, skirt and top included. ' + TAIL)
E = ('Dress the character in only the outfit from the reference picture, in the same colours. Take off everything '
     'else the character wears now, trousers, skirt and top included. ' + BACK + TAIL)


def w0(words):
    return f'Dress the character in the outfit from the reference picture: {words}' + REPLACE + TAIL


def w(words):
    return 'Dress the character in the outfit from the reference picture' + REPLACE + BACK \
        + f'Change only this about the outfit: {words}. ' + TAIL


F11, F12 = 3465439644, 543448490


def cases():
    return [('g1_DN_fab', DN, F11), ('g1_DN_s42', DN, 42), ('g1_DN_s7', DN, 7),
            ('g1_E_fab', E, F11), ('g1_E_s42', E, 42), ('g1_E_s7', E, 7),
            ('g1_W0_fab', w0('G string on the back view'), F12),
            ('g1_Wg_fab', w('G string seen from behind'), F12), ('g1_Wg_s42', w('G string seen from behind'), 42),
            ('g1_Wg_s7', w('G string seen from behind'), 7),
            ('g1_Wr_fab', w('in red'), F12), ('g1_Wr_s42', w('in red'), 42)]


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, src in SRC.items():
        if not os.path.exists(f'{qf2.IN}/{name}'):
            shutil.copy(src, f'{qf2.IN}/{name}')
    for tag, prompt, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': REF}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
