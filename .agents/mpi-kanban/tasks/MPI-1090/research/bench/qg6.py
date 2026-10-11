"""MPI-1090 round 4: words that PICK from the reference ("the green jacket" off a man in jacket, scarf and trousers,
MPI-1041 F2's jacket reference) in round 3's winning shape, so the modify fix does not break picking. Control: the
shipped splice string ("...reference picture: the green jacket, replacing ..."). Shoulder lock graph (qg4).
usage: qg6.py <out> <X1|X3>. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
sys.path.insert(0, HERE)
import qf2
import qg1
import qg4
import qg5

JACKET = 'mpi1041f2_ref_jacket.png'
W = 'the green jacket'
SHIPPED = (f'Dress the character in the outfit from the reference picture: {W}, replacing all of the clothes the character '
           'wears now, top and bottom. ' + qg1.TAIL)


def cases(shape):
    fn = getattr(qg5, shape.lower())
    return ([(f'g6_{shape}j_{t}', fn(W), s) for t, s in (('fab', qg1.F12), ('s42', 42), ('s7', 7))]
            + [(f'g6_shipj_{t}', SHIPPED, s) for t, s in (('s42', 42), ('s7', 7))])


if __name__ == '__main__':
    out, shape = sys.argv[1], sys.argv[2]
    api = qg4.graph(out)
    for tag, prompt, seed in cases(shape):
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qg1.SHEET}, 'Input_Image_2': {'string': JACKET}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
