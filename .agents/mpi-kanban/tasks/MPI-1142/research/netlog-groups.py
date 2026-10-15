# Groups of 3 s+ ResourceScheduler waits over the whole log, plus every *stream* request's lifetime.
import json, sys, collections
d = json.loads(open(sys.argv[1], encoding='utf-8').read())
R = {v: k for k, v in d['constants']['logEventTypes'].items()}
req = collections.defaultdict(dict)
for e in d['events']:
    t, sid, ph, p = R[e['type']], e['source']['id'], e.get('phase'), e.get('params') or {}
    ms = int(e['time']); r = req[sid]
    if t == 'REQUEST_ALIVE' and ph == 1: r.update(start=ms, url=p.get('url', ''), prio=p.get('priority'))
    elif t == 'REQUEST_ALIVE' and ph == 2: r['end'] = ms
    elif t == 'DELEGATE_INFO' and ph == 1: r['blk'] = ms
    elif t == 'DELEGATE_INFO' and ph == 2 and 'blk' in r:
        w = ms - r.pop('blk'); r['blocked'] = r.get('blocked', 0) + w
        if w > 3000: r['freed'] = ms
app = {k: r for k, r in req.items() if 'url' in r}
t0 = min(r['start'] for r in app.values()); T = lambda ms: (ms - t0) / 1000
end = max(r.get('end', r['start']) for r in app.values())
print(f'log spans {T(end):.0f} s')
for k, r in app.items():
    if 'stream' in r['url']: print(f"stream {k} {T(r['start']):7.1f}->{T(r['end']) if 'end' in r else 'open':>7} {r['prio']} {r['url'][-40:]}")
g = collections.defaultdict(list)
for r in app.values():
    if r.get('blocked', 0) > 3000: g[round(T(r['start']))].append(r)
for k, v in sorted(g.items()):
    kinds = collections.Counter(x['url'].rsplit('.', 1)[-1].split('&')[0][:12] for x in v)
    print(f"t~{k:4}s {len(v):3} waited, freed at {T(min(x['freed'] for x in v)):.1f}s, max {max(x['blocked'] for x in v)} ms {dict(kinds)}")
