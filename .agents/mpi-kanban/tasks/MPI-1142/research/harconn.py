# MPI-1142: for each load that queued > 5 s, show what every connection to the app server was doing then.
# usage: python harconn.py <file.har>
import json, sys
from datetime import datetime

h = json.load(open(sys.argv[1], encoding='utf-8'))
ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
rows = []
for e in h['log']['entries']:
    u = e['request']['url']
    if ':3000' not in u:
        continue
    t = e['timings']
    start = ts(e['startedDateTime'])
    q = max(t.get('blocked', 0), 0) + max(t.get('_blocked_queueing', 0), 0) * 0
    rows.append(dict(start=start, end=start + max(e['time'], 0) / 1000, time=e['time'], q=t.get('blocked', -1),
                     conn=e.get('_connectionId', '-'), st=e['response']['status'], err=e['response'].get('_error') or '',
                     kind=e.get('_resourceType', ''), url=u.split(':3000', 1)[1][:110]))
rows.sort(key=lambda r: r['start'])
t0 = rows[0]['start']
stalls = [r for r in rows if r['q'] > 5000]
print(len(rows), 'requests to :3000;', len(stalls), 'queued > 5 s')
seen = set()
for s in stalls:
    key = round(s['start'] + s['q'] / 1000)  # group stalls that released together
    if key in seen:
        continue
    seen.add(key)
    w0, w1 = s['start'], s['start'] + s['q'] / 1000
    print(f"\n=== stall {w0 - t0:8.1f}s .. {w1 - t0:8.1f}s ({s['q']:.0f} ms) first victim {s['url']}")
    for r in rows:
        if r['start'] <= w1 and r['end'] >= w0 and r['q'] < 3000 and r['time'] > 2000:
            print(f"  conn={r['conn']:>5} {r['start'] - t0:8.1f}s..{r['end'] - t0:8.1f}s {r['time']:8.0f}ms st={r['st']} {r['err']} {r['kind']} {r['url']}")
