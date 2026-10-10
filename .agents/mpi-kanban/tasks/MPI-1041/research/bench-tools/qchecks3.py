"""MPI-1041 Phase E round 3. Round 2: the one-word classification was right on all 8 single-outfit sheets and wrong on
both MIXED ones (a jacket front + bikini back; a jacket over boxer shorts, no trousers) - it judges the sheet as a whole.
The fix asks per VIEW (front body = left quarter, back body = second quarter) and per HALF (upper, lower body). This
round benches the SHIPPED checks (`SHEET_CLOTHES_CHECKS`, read from the FlowDef: ask + region verbatim) on round 2's
ten sheets. Rule: every answer CLOTHES clears; anything else refuses. Only the three ordinary-clothes sheets may clear.

  qchecks3.py ask <outdir>
GPU work on :8188 ONLY, under gpu_lease (run_qchecks3.sh). No edits.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qtemplates import describe, IN   # noqa: E402
from qchecks import answer_words, shipped   # noqa: E402
from qchecks2 import SHEETS2   # noqa: E402


def crop(image, region):
    from PIL import Image
    im = Image.open(os.path.join(IN, image)).convert('RGB')
    W, H = im.size
    box = (round(region['x'] * W), round(region['y'] * H), round((region['x'] + region['width']) * W),
           round((region['y'] + region['height']) * H))
    name = 'mpi1041chk_%d_%s' % (box[0], image)
    im.crop(box).save(os.path.join(IN, name))
    return name


def ask(out):
    checks = shipped({})['checks']
    assert len(checks) == 4 and all(c.get('region') for c in checks), checks
    res, wrong = [], []
    for tag, (image, truth) in SHEETS2.items():
        words = []
        for c in checks:
            r = describe(crop(image, c['region']), c['ask'])
            w = answer_words(r['raw']) if r['raw'] is not None else None
            words.append(w)
            part = 'upper' if 'upper' in c['ask'] else 'lower'
            view = 'front' if c['region']['x'] == 0 else 'back'
            res.append({'sheet': tag, 'truth': truth, 'view': view, 'part': part, 'words': w, 'raw': r['raw']})
            print(f'{tag:9s} {truth:9s} {view:5s} {part:5s} -> {w}', flush=True)
        clears = all(w == c['refuseUnless'] for w, c in zip(words, checks))
        want = truth == 'CLOTHES'
        if clears != want:
            wrong.append(f"{tag}: {'CLEARS (unsafe)' if clears else 'refuses (safe)'}")
        print(f'== {tag}: {"clears" if clears else "refused"} ({"right" if clears == want else "WRONG"})', flush=True)
    json.dump({'answers': res, 'wrong': wrong}, open(os.path.join(out, 'checks3_results.json'), 'w', encoding='utf-8'), indent=1)
    print('wrong', len(wrong), 'of', len(SHEETS2), *wrong, sep='\n   ')


if __name__ == '__main__':
    ask(sys.argv[2])
