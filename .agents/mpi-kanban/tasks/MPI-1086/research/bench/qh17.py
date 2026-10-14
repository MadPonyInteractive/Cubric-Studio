"""MPI-1086 phase B round 17. qh16: the mannequin reference fixes the hair, but Klein copies the reference's HEAD POSE
(the man's 3/4 photo -> a turned head under the locked old face: Fabio's double ear) and the mannequin kept the photo's
jewellery, blouse and background (braids). Here the mannequin pass also turns the head to the camera and strips it bare.
  M2 mannequin string, Fabio's seed; describer asked for roots / two-tone (ASK2); lock A only (shipped lock 2, no cut-out).
Sheets as qh16 (W buns / M man / B braids), s42 / s7.
usage: qh17.py <out> [only...]. Under gpu_lease only.
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh11
import qh12
import qh16
import qf2

M2 = ('Replace the person with a plain white mannequin head and shoulders facing the camera, front view, with exactly '
      'the same hairstyle and hair colour. No jewellery and no clothes, on a plain grey background.')
ASK2 = qh12.ASK.replace('and the hair colour.', 'and the hair colour, naming each colour and where it is when the hair has '
                        'darker roots or more than one colour.')


def mannequin(out, ref):
    k = ref[len('mpi1086_'):-4]
    name = f'mpi1086_man2_{k}.png'
    if not os.path.exists(f'{qf2.IN}/{name}'):
        tag = f'h17_man_{k}'
        print(tag, M2, flush=True)
        qf2.run(out, [{'tag': tag, 'api': qf2.KLEIN_API, 'set': {
            'Input_wf_type': {'int': 4}, 'Input_Image': {'image': ref}, 'Input_Positive': {'string': M2},
            'Input_Seed': {'int': qh16.MSEED}}}], tag)
        shutil.copy(f'{out}/{tag}.png', f'{qf2.IN}/{name}')
    return name


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    dpath = f'{out}/h17_describe.json'
    desc = json.load(open(dpath, encoding='utf-8')) if os.path.exists(dpath) else {}
    refs = {}
    for s, (_, _, ref) in qh16.SHEETS.items():
        refs[s] = mannequin(out, ref)
        if refs[s] not in desc:
            desc[refs[s]] = qh12.describe(refs[s], ASK2)
            print(refs[s], '->', desc[refs[s]], flush=True)
            json.dump(desc, open(dpath, 'w', encoding='utf-8'), indent=1)
    api = qh16.graph(out, 'A')
    # N = the same words, no reference picture (Input_Reference false): the mannequin only feeds the describer
    for s, n, (t, seed) in [(s, n, x) for s in qh16.SHEETS for n in ('', 'N') for x in qh1.SEEDS[1:]]:
        tag = f'h17_{n}{"_" if n else ""}{s}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        prompt = qh11.d3(desc[refs[s]].strip().rstrip('.'))
        if n:
            prompt = prompt.replace(' from the reference picture', '')
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Image_2': {'string': refs[s]},
            'Input_Lock': {'int': 2}, 'Input_Reference': {'boolean': not n},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
