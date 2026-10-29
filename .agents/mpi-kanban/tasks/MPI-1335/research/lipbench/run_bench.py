# MPI-1335 step 2b: run the lip-bench variants in Fabio's app (his rented Pod), one at a time.
# Each run swaps its graph into comfy_workflows/flow_video_edit.json (the app fetches it per run) and the
# shipped graph is restored after EVERY run, pass or fail. Repeats showcase run flowVideoEdit_011 exactly:
# ref2v_004 + edit_002, the woman into the picture's room, 768p, empty prompt, seed 3040433610.
#   python -I run_bench.py http://127.0.0.1:3000 V1_shipped V2_soundtrack V3_lora V4_both
import json, os, shutil, sys, time, urllib.parse, urllib.request

BASE, NAMES = sys.argv[1].rstrip('/'), sys.argv[2:]
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..', '..'))
LIVE = os.path.join(REPO, 'comfy_workflows', 'flow_video_edit.json')
SHIPPED = os.path.join(HERE, 'V1_shipped.json')
SHOW = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Video edit showcase/Media/'
FIELDS = {'Input_Operation': 1, 'Input_Keep_Background': False, 'Input_Who': 'the woman',
          'Input_Target': '', 'Input_Quality': 1032192, 'positive': ''}
SEED = 3040433610


def post(path, body, timeout=60):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def put_graph(src):
    shutil.copyfile(src, LIVE)
    os.utime(LIVE, None)  # a fresh mtime, so the renderer's fetch cannot reuse a cached copy


folder = os.environ.get('BENCH_FOLDER')  # a rerun lands in the same project
if not folder:
    proj = post('/connector/create-project', {'name': 'MPI-1335 lip bench'})
    print('project', json.dumps(proj), flush=True)
    folder = proj['project']['folderPath']


def stage(path):
    q = urllib.parse.quote(folder)
    r = post(f'/project-media/agent/place-preview-asset?folderPath={q}', {'dataUrl': path, 'ext': os.path.splitext(path)[1]})
    assert r.get('success'), r
    return r['filePath']


media = [{'role': 'video1', 'url': stage(SHOW + 'ref2v_004.mp4')}, {'role': 'image1', 'url': stage(SHOW + 'edit_002.png')}]
for name in NAMES:
    put_graph(os.path.join(HERE, name + '.json'))
    t0 = time.time()
    try:
        r = post('/connector/generate', {'flowId': 'video-edit', 'fields': FIELDS, 'media': media, 'seed': SEED,
                                         'folderPath': folder, 'cardName': name, 'requestId': f'mpi1335-{name}'}, timeout=7200)
    except Exception as e:
        r = {'ok': False, 'error': repr(e)}
    finally:
        put_graph(SHIPPED)
    print(f'{name}: {time.time() - t0:.0f}s', json.dumps(r)[:1500], flush=True)
print('ALL DONE', flush=True)
