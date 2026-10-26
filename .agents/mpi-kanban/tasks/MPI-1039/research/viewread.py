# MPI-1039 view-read accuracy: can the describer tell which camera view a picture is?
# Truth = the bench cells whose view Fabio accepted (accepted_prompts.py CELLS, seed 111) + round 50 turned zooms
# + the two front sources. Usage: python viewread.py list | python viewread.py run <out.json>
import base64, io, json, os, subprocess, sys, urllib.parse, urllib.request
from PIL import Image

RES = r'C:\AI\Mpi\Cubric-Vision\.agents\mpi-kanban\tasks\MPI-1039\research'
OUT = os.path.join(RES, 'out')
STOP = {'front': 'front', 'tq fl': 'tq_fl', 'tq fr': 'tq_fr', 'pr l': 'pr_l', 'pr r': 'pr_r',
        'tqb l': 'tq_bl', 'tqb r': 'tq_br', 'back': 'back'}

def disk(url):
    return urllib.parse.unquote(url.split('path=')[1].split('&')[0])

def cells():
    sys.path.insert(0, RES)
    src = open(os.path.join(RES, 'accepted_prompts.py'), encoding='utf-8').read().split('by_file = {}')[0]
    ns = {'__file__': os.path.join(RES, 'accepted_prompts.py')}
    exec(src, ns)
    rounds, rows = {}, []
    def get(rnd, key):
        if rnd not in rounds:
            rounds[rnd] = json.load(open(os.path.join(OUT, f'mq_blender{rnd}.json')))
        return rounds[rnd].get(key)
    for stop, rnd, key in ns['CELLS']:
        words = stop.split()
        zoom = words[0] == 'zoom'
        if zoom:
            words = words[1:]
            if words[0] in ('hs', 'face', 'eye', 'waist', 'full', 'far', 'rear'):
                continue  # front-source zooms: view = front level, already covered; rear = mixed
            words = words[:-1]  # drop the rung
        h = words[-1] if words[-1] in ('lo', 'hi') else 'level'
        view = ' '.join(words[:-1] if h != 'level' else words)
        if view not in STOP:
            continue
        for n in ('anime', 'photo'):
            k = key.format(n=n)
            if '{n}' not in key and n == 'photo':
                continue
            url = get(rnd, k)
            if url:
                rows.append({'cell': f'{stop} - {n}', 'turn': STOP[view], 'height': h, 'path': disk(url)})
    r23 = json.load(open(os.path.join(OUT, 'mq_blender23.json')))
    pitch = json.load(open(os.path.join(OUT, 'pitch.json')))
    rows.append({'cell': 'source - anime', 'turn': 'front', 'height': 'level', 'path': disk(r23['street 222'])})
    rows.append({'cell': 'source - photo', 'turn': 'front', 'height': 'level', 'path': disk(pitch['body input'])})
    return rows

EXTRA = ('\nFACING: which way the person faces in the picture, said in picture directions (frame-left = the left '
         'edge of the picture as you look at it): front (facing the camera), front-left (turned partly toward '
         'frame-left, most of the face still showing), left (exactly side-on, facing frame-left, a clean profile), '
         'back-left (turned away, facing partly toward frame-left, mostly the back of the head showing), back '
         '(the back turned to the camera), front-right, right, back-right (the same, toward frame-right)\n'
         'CAMERA: where the camera is: level (at their eye level), low (near the ground looking up at them), high '
         '(above them looking down)')
FACING = {'front': 'front', 'front-left': 'tq_fl', 'left': 'pr_l', 'back-left': 'tq_bl', 'back': 'back',
          'front-right': 'tq_fr', 'right': 'pr_r', 'back-right': 'tq_br'}
CAMERA = {'level': 'level', 'low': 'lo', 'high': 'hi'}

def ask():
    js = ("import('file:///C:/AI/Mpi/Cubric-Vision/js/data/flowPrompts/multiAngle.js')"
          ".then(m => process.stdout.write(m.MULTI_ANGLE_DESCRIBE_ASK))")
    return subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout + EXTRA

def jpeg(path):  # as routes/llm.js: <= 1 MP in 16 px steps, nearest, jpeg q85
    im = Image.open(path).convert('RGB')
    w, h = im.size
    if w * h > 1_000_000:
        s = (1_000_000 / (w * h)) ** 0.5
        im = im.resize((max(16, int(w * s / 16) * 16), max(16, int(h * s / 16) * 16)), Image.NEAREST)
    b = io.BytesIO()
    im.save(b, 'JPEG', quality=85)
    return base64.b64encode(b.getvalue()).decode()

def read(path, question, key):
    body = {'model': 'google/gemma-4-26B-A4B-it', 'temperature': 0, 'max_tokens': 900, 'messages': [{'role': 'user',
            'content': [{'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{jpeg(path)}'}},
                        {'type': 'text', 'text': question}]}]}
    req = urllib.request.Request('https://api.deepinfra.com/v1/openai/chat/completions', json.dumps(body).encode(),
                                 {'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    return d['choices'][0]['message']['content'], d.get('usage', {})

def field(text, name):
    for line in text.splitlines():
        if line.strip().upper().startswith(name + ':'):
            return line.split(':', 1)[1].strip().strip('."').lower()
    return ''

if __name__ == '__main__':
    rows = cells()
    if sys.argv[1] == 'list':
        for r in rows:
            print(r['turn'], r['height'], r['cell'], os.path.exists(r['path']))
        print(len(rows), 'pictures')
        sys.exit()
    out = sys.argv[2]
    done = json.load(open(out)) if os.path.exists(out) else {}
    q, key = ask(), os.environ['DEEPINFRA_API_KEY']
    for r in rows:
        if r['cell'] in done:
            continue
        text, usage = read(r['path'], q, key)
        done[r['cell']] = {**r, 'text': text, 'usage': usage}
        json.dump(done, open(out, 'w'), indent=1)
    tin = sum(v['usage'].get('prompt_tokens', 0) for v in done.values())
    tout = sum(v['usage'].get('completion_tokens', 0) for v in done.values())
    ok_t = ok_h = ok_both = 0
    for v in done.values():
        t = FACING.get(field(v['text'], 'FACING'), '?' + field(v['text'], 'FACING'))
        h = CAMERA.get(field(v['text'], 'CAMERA'), '?' + field(v['text'], 'CAMERA'))
        ok_t += t == v['turn']; ok_h += h == v['height']; ok_both += t == v['turn'] and h == v['height']
        mark = '' if (t, h) == (v['turn'], v['height']) else '   <-- WRONG'
        print(f"{v['cell']:28} truth {v['turn']:6} {v['height']:5} read {t:8} {h:6}{mark}")
    n = len(done)
    print(f'turn {ok_t}/{n}  height {ok_h}/{n}  both {ok_both}/{n}  tokens in {tin} out {tout}  '
          f'cost ${tin * 7e-8 + tout * 3.4e-7:.4f}')
