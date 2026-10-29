# MPI-1335 masked-route seam bench: S1 (soundtrack, masked hair 768p, flowVideoEdit_006 = blend 24) re-run with
# InpaintCropImproved's mask_blend_pixels at 64 and 96 (graphs B64_blend / B96_blend from build_variants.py).
# Same seed, clip and prompt as S1, so the blend is the only change. Same swap/restore rule as run_bench.py.
#   python -I run_seam.py http://127.0.0.1:3000 "<project folder>"
import json, os, shutil, sys, threading, time, urllib.parse, urllib.request

BASE, folder = sys.argv[1].rstrip('/'), sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'flow_video_edit.json'))
SHOW = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Video edit showcase/Media/'
FIELDS = {'Input_Operation': 5, 'Input_Target': 'hair', 'Input_Quality': 1032192, 'positive': 'Her hair is bright red.'}
RUNS = [('B64_blend', 'seam_blend64_768'), ('B96_blend', 'seam_blend96_768')]


def call(path, body=None, timeout=60):
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def put_graph(name):
    shutil.copyfile(os.path.join(HERE, name + '.json'), LIVE)
    os.utime(LIVE, None)


r = call(f'/project-media/agent/place-preview-asset?folderPath={urllib.parse.quote(folder)}',
         {'dataUrl': SHOW + 'ref2v_004.mp4', 'ext': '.mp4'})
assert r.get('success'), r
video = r['filePath']
for graph, name in RUNS:
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

    threading.Thread(target=sample, daemon=True).start()
    put_graph(graph)
    t0 = time.time()
    try:
        r = call('/connector/generate', {'flowId': 'video-edit', 'fields': FIELDS, 'media': [{'role': 'video1', 'url': video}],
                                         'folderPath': folder, 'cardName': name, 'requestId': f'mpi1335-{name}'}, timeout=7200)
    except Exception as e:
        r = {'ok': False, 'error': repr(e)}
    finally:
        put_graph('V1_shipped')
        done.set()
    print(f'{name}: {time.time() - t0:.0f}s peak RAM {peak["ram"] / 1e9:.1f} GB, VRAM {peak["vram"] / 1e9:.1f} GB',
          json.dumps(r)[:1200], flush=True)
print('ALL DONE', flush=True)
