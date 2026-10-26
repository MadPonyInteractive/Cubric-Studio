# MPI-1039 view read, wording round 2: ask what is VISIBLE (eyes, which edge the nose points to, top of head vs
# underside of chin) and work the view out in code, instead of asking the reader to name the view.
# Usage: python viewread2.py <out.json>   (DEEPINFRA_API_KEY in the env)
import json, os, sys
import viewread as v1

EXTRA = (
    '\nEYES: how many of the person\'s eyes you can see: two (both eyes fully, the face turned to the camera), '
    'two-far-small (both eyes, but the far eye is smaller, partly hidden behind the nose), one (only one eye, the '
    'face in clean profile), none (the face is turned away, only the back of the head or the edge of a cheek)\n'
    'NOSE: which side of the IMAGE the tip of the person\'s nose points toward, as you look at the image: camera '
    '(straight at you), image-left, image-right, hidden (the face is turned away)\n'
    'CHEST: which side of the IMAGE the front of the person\'s chest is turned toward, as you look at the image: '
    'camera, image-left, image-right, away (straight away from you, only their back shows)\n'
    'TOP_OF_HEAD: can you see the top of their head from above, with the floor or ground behind them filling the '
    'background: yes or no\n'
    'UNDER_CHIN: can you see the underside of their chin from below, with their legs or feet large near the camera '
    'and the ceiling or sky behind them: yes or no')


def view(text):
    f = lambda k: v1.field(text, k)
    eyes, nose, chest = f('EYES'), f('NOSE'), f('CHEST')
    side = next((s for s in (nose, chest) if s in ('image-left', 'image-right')), None)
    lr = {'image-left': 'l', 'image-right': 'r'}.get(side)
    if eyes == 'two' and not lr:
        turn = 'front'
    elif eyes in ('two', 'two-far-small'):
        turn = f'tq_f{lr}' if lr else 'front'
    elif eyes == 'one':
        turn = f'pr_{lr}' if lr else '?'
    else:
        turn = f'tq_b{lr}' if lr and chest != 'away' else 'back'
    top, chin = f('TOP_OF_HEAD').startswith('yes'), f('UNDER_CHIN').startswith('yes')
    height = 'hi' if top and not chin else 'lo' if chin and not top else 'level'
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
    n = len(done)
    ok_t = ok_h = ok_b = grp = sd = sn = 0
    hs = {}
    for d in done.values():
        t, h = view(d['text'])
        ok_t += t == d['turn']; ok_h += h == d['height']; ok_b += (t, h) == (d['turn'], d['height'])
        grp += G.get(t) == G[d['turn']]
        if d['turn'] in S and t in S:
            sn += 1; sd += S[t] == S[d['turn']]
        hs.setdefault(d['height'], [0, 0]); hs[d['height']][0] += h == d['height']; hs[d['height']][1] += 1
        mark = '' if (t, h) == (d['turn'], d['height']) else '   <-- WRONG'
        print(f"{d['cell']:28} truth {d['turn']:6} {d['height']:5} read {t:6} {h:6}"
              f" [{v1.field(d['text'], 'EYES')}/{v1.field(d['text'], 'NOSE')}/{v1.field(d['text'], 'CHEST')}]{mark}")
    tin = sum(d['usage'].get('prompt_tokens', 0) for d in done.values())
    tout = sum(d['usage'].get('completion_tokens', 0) for d in done.values())
    print(f'turn {ok_t}/{n} height {ok_h}/{n} both {ok_b}/{n} group {grp}/{n} side {sd}/{sn} height-by-truth {hs} '
          f'cost ${tin * 7e-8 + tout * 3.4e-7:.4f}')
