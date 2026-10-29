# MPI-1335 step 2b, second batch: the soundtrack graph (V2) on the no-lead-in routes and at 1080p, with the Pod's
# peak RAM / VRAM sampled every 10 s from /remote/pod/stats. Waits for the MPI-1331 masked run to land first, so a
# graph swap can never reach a run already queued. Same swap/restore rule as run_bench.py.
#   python -I run_more.py http://127.0.0.1:3000 "<project folder>" <masked_768.log>
import json, os, shutil, sys, threading, time, urllib.parse, urllib.request

BASE, folder, WAIT_LOG = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'flow_video_edit.json'))
SHOW = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Video edit showcase/Media/'
RUNS = [
    ('S1_masked_speech_768', {'Input_Operation': 5, 'Input_Target': 'hair', 'Input_Quality': 1032192,
                              'positive': 'Her hair is bright red.'}, False),
    ('S2_video_room_768', {'Input_Operation': 1, 'Input_Keep_Background': True, 'Input_Who': 'the woman',
                           'Input_Target': '', 'Input_Quality': 1032192, 'positive': ''}, True),
    ('S3_picture_room_1080', {'Input_Operation': 1, 'Input_Keep_Background': False, 'Input_Who': 'the woman',
                              'Input_Target': '', 'Input_Quality': 2088960, 'positive': ''}, True),
]


def call(path, body=None, timeout=60):
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def put_graph(name):
    shutil.copyfile(os.path.join(HERE, name + '.json'), LIVE)
    os.utime(LIVE, None)


while 'ok' not in (open(WAIT_LOG, encoding='utf-8').read() if os.path.exists(WAIT_LOG) else ''):
    time.sleep(20)
print('masked run landed, starting', flush=True)


def stage(path):
    r = call(f'/project-media/agent/place-preview-asset?folderPath={urllib.parse.quote(folder)}',
             {'dataUrl': path, 'ext': os.path.splitext(path)[1]})
    assert r.get('success'), r
    return r['filePath']


video, image = stage(SHOW + 'ref2v_004.mp4'), stage(SHOW + 'edit_002.png')
for name, fields, with_image in RUNS:
    peak, done = {'ram': 0, 'vram': 0}, threading.Event()

    def sample():
        while not done.is_set():
            try:
                s = call('/remote/pod/stats', timeout=10)
                peak['ram'] = max(peak['ram'], s['ram']['used'])
                peak['vram'] = max(peak['vram'], s['vram']['used'])
            except Exception:
                pass
            done.wait(10)

    t = threading.Thread(target=sample, daemon=True)
    t.start()
    media = [{'role': 'video1', 'url': video}] + ([{'role': 'image1', 'url': image}] if with_image else [])
    put_graph('V2_soundtrack')
    t0 = time.time()
    try:
        r = call('/connector/generate', {'flowId': 'video-edit', 'fields': fields, 'media': media, 'folderPath': folder,
                                         'cardName': name, 'requestId': f'mpi1335-{name}'}, timeout=7200)
    except Exception as e:
        r = {'ok': False, 'error': repr(e)}
    finally:
        put_graph('V1_shipped')
        done.set()
    print(f'{name}: {time.time() - t0:.0f}s peak RAM {peak["ram"] / 1e9:.1f} GB, VRAM {peak["vram"] / 1e9:.1f} GB',
          json.dumps(r)[:1200], flush=True)
print('ALL DONE', flush=True)
