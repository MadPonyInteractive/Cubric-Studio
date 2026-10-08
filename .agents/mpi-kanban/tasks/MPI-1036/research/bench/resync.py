# MPI-1036 Phase 2: re-sync H3's output to the source before the stitch. H3 does not frame-lock a reference video:
# it lags 2-4 frames through fast motion, then catches up. For every SOURCE frame, pick the output frame that best
# matches it outside the edited band, then stitch that. Re-uses an existing M5 run's crop_out - no new H3 render.
# Usage: python resync.py M5_horns [M5_remove]   (run under the GPU lease: SAM3 + crop re-run if not cached)
import json, shutil, subprocess, sys, time, urllib.request
import numpy as np

S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/d8220b88-ca41-4225-b100-4ec4a02846cf/scratchpad'
OUTD, IND = 'D:/WORK/Images/Outputs/mpi1036', 'G:/ComfyUi/ComfyUI/input'
exec(open(f'{S}/mask_bench.py', encoding='utf-8').read().split('def call')[0])  # graph(), constants
WIN, TOP = 6, 40  # search +-6 frames; skip the top 40/96 rows, where the edit is


def gray(p, s=96):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vf', f'scale={s}:{s}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                       capture_output=True, check=True).stdout
    return np.frombuffer(r, np.uint8).reshape(-1, s, s).astype(float)[:, TOP:, :]


def indexes(run):
    a, b = gray(f'{OUTD}/{run}_crop_in_00001.mp4'), gray(f'{OUTD}/{run}_crop_out_00001.mp4')
    idx = []
    for i in range(len(a)):
        js = range(max(0, i - WIN), min(len(b), i + WIN + 1))
        idx.append(min(js, key=lambda j: np.abs(a[i] - b[j]).mean()))
    # H3's output starts in sync (measured); near-still opening frames match ambiguously, so pin frame 0
    idx[0] = 0
    # ponytail: running max keeps time moving forward (no back-and-forth); a DP path is the upgrade if it judders
    return list(np.maximum.accumulate(idx))


def call(path, body=None):
    req = urllib.request.Request('http://127.0.0.1:8188' + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


for run in sys.argv[1:]:
    idx = indexes(run)
    print(run, 'source frame -> output frame offset:', [j - i for i, j in enumerate(idx)], flush=True)
    clip = f'mpi1036_{run}_crop_out.mp4'
    shutil.copyfile(f'{OUTD}/{run}_crop_out_00001.mp4', f'{IND}/{clip}')
    g = graph(run)
    for k in ('127', '128', '119', '120', '129', '123', '136', '145', '124', '126', '125', '122', '307', '304', '306'):
        g.pop(k)
    g['400'] = {'class_type': 'LoadVideo', 'inputs': {'file': clip}}
    g['401'] = {'class_type': 'GetVideoComponents', 'inputs': {'video': ['400', 0]}}
    g['402'] = {'class_type': 'GetImagesFromBatchIndexed', 'inputs': {'images': ['401', 0], 'indexes': ', '.join(map(str, idx))}}
    g['309']['inputs']['source'] = ['402', 0]
    g['92']['inputs']['filename_prefix'] = f'mpi1036/R_{run}'
    t0 = time.time()
    pid = call('/prompt', {'prompt': g, 'client_id': 'mpi1036-resync'})['prompt_id']
    while pid not in (h := call(f'/history/{pid}')):
        time.sleep(3)
    st = h[pid]['status']
    outs = [f['subfolder'] + '/' + f['filename'] for o in h[pid]['outputs'].values() for k in ('gifs', 'videos', 'images') for f in o.get(k, [])]
    print(run, st['status_str'], f'{time.time() - t0:.0f}s', outs, flush=True)
    if st['status_str'] != 'success':
        print(json.dumps(st.get('messages', []))[-2000:])
        sys.exit(1)
