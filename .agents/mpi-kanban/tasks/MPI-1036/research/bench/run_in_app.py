# MPI-1036: run the Video Edit FLOW in a running app (app:isolated) through /connector/generate, by preset.
# Under the GPU lease (the route holds its response for the whole render, so the lease covers it):
#   python gpu_lease.py run -- <python> run_in_app.py http://127.0.0.1:<port> A1_masked_horns A2_swap_keep
import json, os, sys, time, urllib.parse, urllib.request

BASE, NAMES = sys.argv[1].rstrip('/'), sys.argv[2:]
IN = 'G:/ComfyUi/ComfyUI/input/'
HORNS = 'two small glossy red demon horns'
PRESETS = {
    # masked route: SAM3 + box + swap LoRA + MpiGradeMatch + stitch
    'A1_masked_horns': dict(video='mpi1036_ears_last3s_24fps.mp4',
                            fields={'Input_Operation': 5, 'Input_Target': 'cat ears', 'positive': HORNS}),
    # whole frame, picture slot, Input_Who, swap LoRA on (op 1 keeping the video's room)
    'A2_swap_keep': dict(video='mpi1036_source_24fps.mp4', image='mpi1036_girl_back_mirror.png',
                         fields={'Input_Operation': 1, 'Input_Who': 'the blonde woman dancing'}),
}


def post(path, body, timeout=60):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


proj = post('/connector/create-project', {'name': 'MPI-1036 Video Edit in-app'})
print('project', json.dumps(proj), flush=True)
folder = proj['project']['folderPath']


def stage(name):
    q = urllib.parse.quote(folder)
    r = post(f'/project-media/agent/place-preview-asset?folderPath={q}', {'dataUrl': IN + name, 'ext': os.path.splitext(name)[1]})
    assert r.get('success'), r
    return r['filePath']


for name in NAMES:
    p = PRESETS[name]
    media = [{'role': 'video1', 'url': stage(p['video'])}]
    if p.get('image'):
        media.append({'role': 'image1', 'url': stage(p['image'])})
    t0 = time.time()
    r = post('/connector/generate', {'flowId': 'video-edit', 'fields': p['fields'], 'media': media,
                                     'folderPath': folder, 'cardName': name, 'requestId': f'mpi1036-{name}'}, timeout=7200)
    print(f'{name}: {time.time() - t0:.0f}s', json.dumps(r)[:1500], flush=True)
print('ALL DONE', flush=True)
