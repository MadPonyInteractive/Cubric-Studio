# MPI-1039 view read, wording round 3: keep round 1's FACING (front / turned / rear group) and CAMERA (low), round 2's
# NOSE (left vs right), and add cues for what rounds 1-2 could not read: 3/4 vs profile (far cheek, nose outline,
# mouth corners), rear 3/4 vs back (ears, a cheek edge beyond the head), and a high camera (floor behind, big head).
# Usage: python viewread3.py <out.json>   (DEEPINFRA_API_KEY in the env)
import json, os, sys
from collections import Counter
import viewread as v1

EXTRA = v1.EXTRA + (
    '\nNOSE: which side of the IMAGE the tip of the person\'s nose points toward, as you look at the image: camera '
    '(straight at you), image-left, image-right, hidden (the face is turned away)\n'
    'FAR_CHEEK: beyond the nose, can you see the cheek on the FAR side of the face (the side turned away from the '
    'camera): yes (some far cheek shows past the nose), no (the nose is the edge of the face), hidden (face turned away)\n'
    'NOSE_OUTLINE: is the tip of the nose drawn against the background, sticking out past the edge of the face: yes or no\n'
    'MOUTH_CORNERS: how many corners of the mouth you can see: two, one, none\n'
    'EARS: how many of the person\'s ears you can see: two, one, none (covered by hair counts as seen if you can tell '
    'where it is)\n'
    'CHEEK_EDGE: if the back of the head faces the camera, does an edge of a cheek, eyelashes or the tip of the nose '
    'show past the outline of the head, and on which side of the IMAGE: none, image-left, image-right; '
    'face-visible if the face itself shows\n'
    'FLOOR_BEHIND: does the floor or ground fill the background behind the person, seen from above (no horizon, '
    'no sky or ceiling behind their head): yes or no\n'
    'HEAD_BIG: does the camera look down on them so their head and shoulders look large and their body shrinks '
    'toward their feet: yes or no')

LR = {'image-left': 'l', 'image-right': 'r'}
FACE_LR = {'front-left': 'l', 'left': 'l', 'back-left': 'l', 'front-right': 'r', 'right': 'r', 'back-right': 'r'}


def cues(text):
    return {k: v1.field(text, k) for k in ('FACING', 'CAMERA', 'NOSE', 'FAR_CHEEK', 'NOSE_OUTLINE',
                                           'MOUTH_CORNERS', 'EARS', 'CHEEK_EDGE', 'FLOOR_BEHIND', 'HEAD_BIG')}


def view(c):
    facing = c['FACING']
    group = 'front' if facing == 'front' else 'rear' if facing.startswith('back') else 'side'
    if group == 'front':
        turn = 'front'
    elif group == 'side':
        lr = LR.get(c['NOSE']) or FACE_LR.get(facing, 'l')
        turn = f'tq_f{lr}' if c['FAR_CHEEK'].startswith('yes') else f'pr_{lr}'
    else:
        lr = LR.get(c['CHEEK_EDGE']) or FACE_LR.get(facing)
        turn = f'tq_b{lr}' if lr and (c['CHEEK_EDGE'] in LR or c['EARS'] == 'one') else 'back'
    cam = c['CAMERA']
    high = cam == 'high' or (c['FLOOR_BEHIND'].startswith('yes') and c['HEAD_BIG'].startswith('yes'))
    height = 'lo' if cam == 'low' else 'hi' if high else 'level'
    return turn, height


if __name__ == '__main__':
    out = sys.argv[1]
    done = json.load(open(out)) if os.path.exists(out) else {}
    q, key = v1.ask().replace(v1.EXTRA, '') + EXTRA, os.environ.get('DEEPINFRA_API_KEY', '')
    for r in v1.cells():
        if r['cell'] in done:
            continue
        text, usage = v1.read(r['path'], q, key)
        done[r['cell']] = {**r, 'text': text, 'usage': usage}
        json.dump(done, open(out, 'w'), indent=1)
    G = {'front': 'front', 'tq_fl': 'side', 'tq_fr': 'side', 'pr_l': 'side', 'pr_r': 'side', 'tq_bl': 'back',
         'tq_br': 'back', 'back': 'back'}
    S = {'tq_fl': 'l', 'pr_l': 'l', 'tq_bl': 'l', 'tq_fr': 'r', 'pr_r': 'r', 'tq_br': 'r'}
    KIND = {'tq_fl': 'tq', 'tq_fr': 'tq', 'pr_l': 'pr', 'pr_r': 'pr', 'tq_bl': 'tqb', 'tq_br': 'tqb', 'back': 'back'}
    n = len(done)
    ok_t = ok_h = ok_b = grp = sd = sn = 0
    hs, split = {}, {}
    for d in done.values():
        c = cues(d['text'])
        t, h = view(c)
        ok_t += t == d['turn']; ok_h += h == d['height']; ok_b += (t, h) == (d['turn'], d['height'])
        grp += G.get(t) == G[d['turn']]
        if d['turn'] in S and t in S:
            sn += 1; sd += S[t] == S[d['turn']]
        hs.setdefault(d['height'], [0, 0]); hs[d['height']][0] += h == d['height']; hs[d['height']][1] += 1
        for cue in ('FAR_CHEEK', 'NOSE_OUTLINE', 'MOUTH_CORNERS', 'EARS', 'CHEEK_EDGE'):
            if d['turn'] in KIND:
                split.setdefault(cue, {}).setdefault(KIND[d['turn']], Counter())[c[cue]] += 1
        for cue in ('CAMERA', 'FLOOR_BEHIND', 'HEAD_BIG'):
            split.setdefault(cue, {}).setdefault(d['height'], Counter())[c[cue]] += 1
        mark = '' if (t, h) == (d['turn'], d['height']) else '   <-- WRONG'
        print(f"{d['cell']:28} truth {d['turn']:6} {d['height']:5} read {t:6} {h:6} [{c['FACING']}/{c['NOSE']}/"
              f"cheek {c['FAR_CHEEK']}/outl {c['NOSE_OUTLINE']}/mouth {c['MOUTH_CORNERS']}/ears {c['EARS']}/"
              f"edge {c['CHEEK_EDGE']}/{c['CAMERA']}/floor {c['FLOOR_BEHIND']}/big {c['HEAD_BIG']}]{mark}")
    print('\nCUE SPLITS (answer counts by true view)')
    for cue, by in split.items():
        print(f'  {cue}: ' + '  '.join(f'{k}={dict(v)}' for k, v in sorted(by.items())))
    tin = sum(d['usage'].get('prompt_tokens', 0) for d in done.values())
    tout = sum(d['usage'].get('completion_tokens', 0) for d in done.values())
    print(f'turn {ok_t}/{n} height {ok_h}/{n} both {ok_b}/{n} group {grp}/{n} side {sd}/{sn} height-by-truth {hs} '
          f'cost ${tin * 7e-8 + tout * 3.4e-7:.4f}')
