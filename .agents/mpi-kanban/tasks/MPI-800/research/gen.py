"""MPI-800 Phase 4: one /connector/generate submit, printed as one line + saved JSON.

    python gen.py <label> '<json body>'

Run it under gpu_lease.py; it asserts on the artefact, never on the exit code.
"""
import json, sys, time, urllib.request, os

SCR = r'C:\Users\Fabio\AppData\Local\Temp\claude\C--AI-Mpi-Cubric-Vision\82de54a1-ff0b-48b7-9264-527ba466dda3\scratchpad'
label, body = sys.argv[1], json.loads(sys.argv[2])
t0 = time.time()
req = urllib.request.Request('http://127.0.0.1:3000/connector/generate',
                             data=json.dumps(body).encode('utf-8'),
                             headers={'Content-Type': 'application/json'})
try:
    raw = urllib.request.urlopen(req, timeout=1900).read().decode('utf-8')
except urllib.error.HTTPError as e:
    raw = e.read().decode('utf-8')
res = json.loads(raw)
out = os.path.join(SCR, f'gen_{label}.json')
open(out, 'w', encoding='utf-8').write(json.dumps({'request': body, 'response': res}, indent=2))
o = res.get('output') or {}
print(f"{label}: ok={res.get('ok')} {int(time.time()-t0)}s "
      f"{res.get('error', {}).get('code', '')} {res.get('error', {}).get('message', '')[:160]} "
      f"item={o.get('itemId', '')} type={o.get('type', '')} file={o.get('filePath', '')[:120]}")
sys.exit(0 if res.get('ok') else 1)
