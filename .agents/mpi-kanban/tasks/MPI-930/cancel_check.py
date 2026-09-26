"""MPI-930/931 live check against the SHARED engine while Fabio's render runs.

Mode 'queued': submit, wait until OUR prompt is pending behind his, Stop it; his must keep running.
Mode 'early': submit and Stop at once (pre-register); the held submit must resolve CANCELLED fast.
Never POSTs /interrupt itself: only the app under test does.
"""
import json, sys, threading, time, urllib.request

APP = f'http://127.0.0.1:{sys.argv[2] if len(sys.argv) > 2 else 53097}'
ENG = 'http://127.0.0.1:48188'
mode = sys.argv[1]
import tempfile
PARENT = tempfile.gettempdir().replace(chr(92), '/')
rid = f'mpi931-{mode}-{int(time.time())}'

def get(url):
    return json.load(urllib.request.urlopen(url, timeout=5))

def post(url, body, timeout=10):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def queue():
    d = get(f'{ENG}/queue')
    return [r[1] for r in d['queue_running']], [p[1] for p in d['queue_pending']]

result = {}
def submit():
    t0 = time.time()
    try:
        result['r'] = post(f'{APP}/connector/generate', {'modelId': 'klein-9b', 'operation': 't2i',
                            'positive': 'a warship', 'requestId': rid}, timeout=600)
    except Exception as e:
        result['r'] = {'exception': str(e)}
    result['secs'] = round(time.time() - t0, 1)

proj = post(f'{APP}/create-project', {'name': f'Cancel Check {int(time.time())}', 'folderPath': PARENT})['project']['folderPath']
print('open    ->', post(f'{APP}/connector/open-project', {'folderPath': proj}).get('ok'), proj)
run0, pend0 = queue()
print('before  running', run0, 'pending', pend0)
th = threading.Thread(target=submit); th.start()
if mode == 'queued':
    for _ in range(90):
        run, pend = queue()
        if [p for p in pend if p not in pend0]:
            break
        time.sleep(1)
    print('queued  running', run, 'pending', pend)
else:
    time.sleep(0.3)
print('cancel ->', post(f'{APP}/connector/cancel', {'requestId': rid}))
th.join(60)
print('submit ->', json.dumps(result)[:300])
time.sleep(3)
run, pend = queue()
print('after   running', run, 'pending', pend)
survived = all(r in run for r in run0)
print('HIS RENDER SURVIVED' if survived else 'HIS RENDER GONE (finished or killed - check history)')
for r in run0:
    h = get(f'{ENG}/history/{r}')
    msgs = [m[0] for m in h.get(r, {}).get('status', {}).get('messages', [])]
    print('his history messages:', msgs or '(still running, no history yet)')
