# MPI-1335 step 1 "before": the two short showcase clips on the soundtrack graph (V2), with the showcase's own fields,
# so the pad-up-cut-back fix has a before that already carries the lip fix. Same swap/restore rule as run_bench.py.
# Step 1 "after": the same, plus the 5 s speech clip, on a graph named by argv[3] (P1_padup), cards suffixed argv[4].
#   python -I run_short.py http://127.0.0.1:3000 "<project folder>" [graph] [suffix] [--with-5s]
import json, os, shutil, sys, time, urllib.parse, urllib.request

BASE, folder = sys.argv[1].rstrip('/'), sys.argv[2]
GRAPH = sys.argv[3] if len(sys.argv) > 3 else 'V2_soundtrack'
SUFFIX = sys.argv[4] if len(sys.argv) > 4 else 'v2'
HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'flow_video_edit.json'))
SHOW = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Video edit showcase/Media/'
RUNS = [  # (card, clip, picture, fields) as the showcase ran them (sidecars a782539c / e09f7282)
    ('short_0875_v2', 'resizeVideo_010.mp4', 'edit_002.png',
     {'Input_Operation': 1, 'Input_Keep_Background': False, 'Input_Who': 'the woman', 'Input_Target': '',
      'Input_Quality': 1032192, 'positive': ''}),
    ('short_217_v2', 'resizeVideo_005.mp4', 'edit_001.png',
     {'Input_Operation': 4, 'Input_Keep_Background': False, 'Input_Who': 'the man', 'Input_Target': '',
      'Input_Quality': 1032192,
      'positive': 'the hellish hellscape background from <image1>: rivers of molten lava between cracked black rock, '
                  'thick smoke, glowing ash, burning mountains, dramatic fiery orange and red light'}),
]
if '--with-5s' in sys.argv:  # the step 2b lip clip, template 6 768p as V2 ran it
    RUNS.append(('speech_5s_v2', 'ref2v_004.mp4', 'edit_002.png',
                 {'Input_Operation': 1, 'Input_Keep_Background': False, 'Input_Who': 'the woman', 'Input_Target': '',
                  'Input_Quality': 1032192, 'positive': ''}))


def call(path, body=None, timeout=60):
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def stage(name):
    r = call(f'/project-media/agent/place-preview-asset?folderPath={urllib.parse.quote(folder)}',
             {'dataUrl': SHOW + name, 'ext': os.path.splitext(name)[1]})
    assert r.get('success'), r
    return r['filePath']


def put_graph(name):
    shutil.copyfile(os.path.join(HERE, name + '.json'), LIVE)
    os.utime(LIVE, None)


for card, clip, picture, fields in RUNS:
    card = card.replace('_v2', '_' + SUFFIX)
    media = [{'role': 'video1', 'url': stage(clip)}, {'role': 'image1', 'url': stage(picture)}]
    put_graph(GRAPH)
    t0 = time.time()
    try:
        r = call('/connector/generate', {'flowId': 'video-edit', 'fields': fields, 'media': media, 'folderPath': folder,
                                         'cardName': card, 'requestId': f'mpi1335-{card}'}, timeout=7200)
    except Exception as e:
        r = {'ok': False, 'error': repr(e)}
    finally:
        put_graph('V1_shipped')
    print(f'{card}: {time.time() - t0:.0f}s', json.dumps(r)[:900], flush=True)
print('ALL DONE', flush=True)
