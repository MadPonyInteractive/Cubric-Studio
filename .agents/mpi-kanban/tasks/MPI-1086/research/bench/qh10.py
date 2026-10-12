"""MPI-1086 phase B round 4: the picture turned into WORDS. The bodies never took a hairstyle from a picture (0/21,
qh3 + qh8) but always took one from words (qh4). A hand-written description stands in for the describer.
  D1 - the SHIPPED Hairstyle string with the description as the words, reference picture ON
  D2 - "the hairstyle and hair colour from the reference picture: <description>" + every figure named, picture ON
  D0 - D1 with the picture OFF (words only): does the picture add anything over its description?
Photo P (Fabio's buns), fab / s42 / s7, lock 2, the B3 graph.
usage: qh10.py <out> [only...]. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qh3

DESC = ('messy platinum blonde hair tied up in two curly space buns on top of the head, with a wispy curly fringe and '
        'loose curly strands framing the face')
D1 = qh1.hair(DESC)
D2 = (f'Give the character the hairstyle and hair colour from the reference picture: {DESC}, with the head uncovered and '
      f'no hat. {qh3.ALL} {qh3.KEEP}')

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    api = qh2.graph(out, 'B3')
    for name, prompt, ref in (('D1', D1, True), ('D2', D2, True), ('D0', D1, False)):
        for t, seed in qh1.SEEDS:
            tag = f'h10_{name}_{t}'
            if only and not any(tag.startswith(o) for o in only):
                continue
            if os.path.exists(f'{out}/{tag}.png'):
                print(tag, 'exists, skipped', flush=True)
                continue
            print(tag, prompt, flush=True)
            qh1.qf2.run(out, [{'tag': tag, 'api': api, 'set': {
                'Input_Image': {'string': qh1.SHEET}, 'Input_Image_2': {'string': qh3.REFS['P']},
                'Input_Reference': {'boolean': ref}, 'Input_Positive': {'string': prompt},
                'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 2}}}], tag)
