# MPI-1142: read a Chromium net log (main.js writes <userData>/logs/netlog.json on a source run).
# Lists every app-server request that waited 3 s+ before the network stack ran it (DELEGATE_INFO
# blocked time), then, at the start of the worst waits, every request still alive and how old it is:
# the holders. Tolerates a log cut off mid-write (app quit before the recording stopped).
# usage: python netlog.py <netlog.json>
import json, sys, collections

s = open(sys.argv[1], encoding='utf-8').read().rstrip().rstrip(',')
try: d = json.loads(s)  # a finished log closes with polledData
except json.JSONDecodeError: d = json.loads(s + ']}')
R = {v: k for k, v in d['constants']['logEventTypes'].items()}
req = collections.defaultdict(dict)
for e in d['events']:
    t, sid, ph, p = R[e['type']], e['source']['id'], e.get('phase'), e.get('params') or {}
    ms = int(e['time'])
    r = req[sid]
    if t == 'REQUEST_ALIVE':
        if ph == 1: r.update(start=ms, url=p.get('url', ''), prio=p.get('priority'))
        elif ph == 2: r['end'] = ms
    elif t == 'DELEGATE_INFO' and ph == 1:
        r['blk_at'], r['blk_by'] = ms, p.get('delegate_blocked_by')
    elif t == 'DELEGATE_INFO' and ph == 2 and 'blk_at' in r:
        r['blocked'] = r.get('blocked', 0) + ms - r.pop('blk_at')
    elif t == 'URL_REQUEST_DELEGATE_RESPONSE_STARTED' and ph == 2:
        r.setdefault('resp', ms)
    elif t == 'RESOURCE_SCHEDULER_REQUEST_STARTED':
        r.setdefault('sched', ms)

app = {k: r for k, r in req.items() if '127.0.0.1' in r.get('url', '')}
short = lambda u: u.split(':', 2)[-1].split('/', 1)[-1][-70:]
t0 = min(r['start'] for r in app.values())
waited = sorted((r for r in app.values() if r.get('blocked', 0) > 3000), key=lambda r: r['start'])
print(f"{len(app)} app requests, {len(waited)} blocked 3 s+ ({collections.Counter(r.get('blk_by') for r in waited)})")
for r in waited[:40]:
    print(f"  t={(r['start'] - t0) / 1000:7.1f}s blocked {r['blocked']:6d}ms {str(r['prio']):7} {short(r['url'])}")
seen = set()
for r in waited:
    k = round(r['start'] / 1000)
    if k in seen: continue
    seen.add(k)
    at = r['start']
    alive = [x for x in app.values() if x['start'] < at and x.get('end', 10**15) > at and x is not r]
    print(f"\nat t={(at - t0) / 1000:.1f}s ({short(r['url'])} waits) {len(alive)} alive:")
    for x in sorted(alive, key=lambda x: x['start']):
        resp = f"resp+{x['resp'] - x['start']}ms" if 'resp' in x else 'no resp'
        print(f"    {str(x['prio']):7} age {(at - x['start']) / 1000:6.1f}s {resp:14} {short(x['url'])}")
    if len(seen) >= 4: break
