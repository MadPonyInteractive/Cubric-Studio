"""MPI-1086 phase D: the new "Custom" change (Fabio 2026-10-12, option B): a free edit in the user's own words, lock 0.
Words are whatever a user types - an instruction ("make her a robot") or a bare description ("a vampire").
  C1 - the words as they are, then the accessories tail (back = "seen from behind", MPI-1041 F1 0/10 redraws)
  C2 - "Change the character in this character sheet: <words>." + the same tail
Sheet = Fabio's flowCSFI_002, the B3 graph (lock 0 never reads the cut). Seeds s42 / s7.
usage: qh6.py <out> [only...]. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2

TAIL = ' Make the same change on the character seen from behind and in the close-up portrait on the right. ' \
       'Keep everything else exactly as it is.'
WORDS = {'vampire': 'a vampire with pale skin and red eyes', 'robot': 'make her a robot with metal skin',
         'sword': 'holding a sword'}


def c1(w):
    return w[0].upper() + w[1:] + '.' + TAIL


def c2(w):
    return f'Change the character in this character sheet: {w}.' + TAIL


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    api = qh2.graph(out, 'B3')
    cs = [(f'h6_{n}_{k}_{t}', api, f(w), seed, 0)
          for n, f in (('C1', c1), ('C2', c2)) for k, w in WORDS.items() for t, seed in qh1.SEEDS[1:]]
    qh1.go(out, [c for c in cs if not only or any(c[0].startswith(o) for o in only)])
