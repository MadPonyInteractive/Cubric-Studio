# MPI-1331 validation: one masked Video Edit run at 768p on the SHIPPED graph, in Fabio's app (his Pod).
# 5 s speech clip ref2v_004, SAM3 target "hair": the square is well under the frame's short edge, so node 230
# must size the crop from the source instead of upscaling it to 768.
#   python -I masked_768.py http://127.0.0.1:3000 "<project folder>"
import json, sys, time, urllib.parse, urllib.request

BASE, folder = sys.argv[1].rstrip('/'), sys.argv[2]
SRC = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Video edit showcase/Media/ref2v_004.mp4'


def post(path, body, timeout=60):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


r = post(f'/project-media/agent/place-preview-asset?folderPath={urllib.parse.quote(folder)}', {'dataUrl': SRC, 'ext': '.mp4'})
assert r.get('success'), r
fields = {'Input_Operation': 5, 'Input_Target': 'hair', 'Input_Quality': 1032192, 'positive': 'Her hair is bright red.'}
t0 = time.time()
r = post('/connector/generate', {'flowId': 'video-edit', 'fields': fields, 'media': [{'role': 'video1', 'url': r['filePath']}],
                                 'folderPath': folder, 'cardName': 'MPI-1331 masked 768p hair', 'requestId': 'mpi1331-masked-768'},
         timeout=7200)
print(f'{time.time() - t0:.0f}s', json.dumps(r)[:1500], flush=True)
