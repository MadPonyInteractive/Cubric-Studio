"""MPI-1090 round 5: Fabio's front+back reference (Combine Images, Qwen 2.1/Media/sheet_001.png: the dress front and a
full-length side/back photo) with the SHIPPED strings on the shoulder-lock graph. Watch for an extra figure: a
reference holding a second figure drew one in MPI-1041 F2 round 2.
  R5n - no words (qg4.LC)    R5g - "G string on the back view" -> qg5.x3("G string seen from behind")
usage: qg7.py <out>. Under gpu_lease only.
"""
import os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
sys.path.insert(0, HERE)
import qf2
import qg1
import qg4
import qg5

REF = 'mpi1090_ref_sheet001.png'
SRC = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media/sheet_001.png'


def cases():
    g = qg5.x3('G string seen from behind')
    return ([(f'g7_R5n_{t}', qg4.LC, s) for t, s in (('fab', qg1.F11), ('s42', 42), ('s7', 7))]
            + [(f'g7_R5g_{t}', g, s) for t, s in (('fab', qg1.F12), ('s42', 42), ('s7', 7))])


if __name__ == '__main__':
    out = sys.argv[1]
    if not os.path.exists(f'{qf2.IN}/{REF}'):
        shutil.copy(SRC, f'{qf2.IN}/{REF}')
    api = qg4.graph(out)
    for tag, prompt, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qg1.SHEET}, 'Input_Image_2': {'string': REF}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
