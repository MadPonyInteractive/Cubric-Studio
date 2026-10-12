"""MPI-1101 Phase 4: one Make seamless run through an ISOLATED app's /connector/generate (the agent's path:
planner -> windows -> paste -> one card). Waits until the engine queue has stayed empty for 30 s, then prints the
project's cards. Run ONLY under the GPU lease:
  python <gpu_lease.py> run --timeout 3600 --poll 2 -- python run_e2e.py <app url> <project folder> <body.json>"""
import json, sys, time, urllib.error, urllib.request

app, folder, body_path = sys.argv[1:4]
ENGINE = 'http://127.0.0.1:48188'


def post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.load(r)


body = json.load(open(body_path, encoding='utf-8'))
body['folderPath'] = folder
t0 = time.time()
try:
    sub = post(app + '/connector/generate', body)
except urllib.error.HTTPError as e:
    sub = json.load(e)
print('submit', json.dumps(sub)[:600], flush=True)
# Never hold the lease for a run that is not running: a refused submit, or an engine that
# never takes a job within 3 minutes (the describer may run first), ends here.
if not sub.get('ok'):
    sys.exit(1)
busy_seen, idle_since = False, None
# The connector answers when the run has LANDED (output present): nothing left to wait for.
while not sub.get('output') and time.time() - t0 < 3000:
    time.sleep(3)
    q = json.load(urllib.request.urlopen(ENGINE + '/queue'))
    busy = bool(q.get('queue_running') or q.get('queue_pending'))
    busy_seen |= busy
    if not busy_seen and time.time() - t0 > 180:
        print('the engine never took a job', flush=True)
        break
    if busy:
        idle_since = None
    elif busy_seen:
        idle_since = idle_since or time.time()
        if time.time() - idle_since > 30:
            break
print('engine idle after %.0fs' % (time.time() - t0), flush=True)
proj = post(app + '/get-project', {'folderPath': folder})
for g in (proj.get('project') or proj).get('itemGroups', []):
    print(json.dumps({k: g.get(k) for k in ('id', 'name', 'customName', 'history', 'selectedIndex')})[:900])
