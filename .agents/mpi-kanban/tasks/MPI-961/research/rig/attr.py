"""Self time of named native calls in a .cpuprofile, grouped by their JS caller chain.
   python attr.py <profile> [fn ...]"""
import json, sys
p = json.load(open(sys.argv[1]))
fns = sys.argv[2:] or ['toDataURL', 'clearRect', 'drawImage']
by = {n['id']: n for n in p['nodes']}
par = {c: n['id'] for n in p['nodes'] for c in n.get('children', [])}
self = {}
for i, s in enumerate(p['samples']):
    self[s] = self.get(s, 0) + (p['timeDeltas'][i + 1] if i + 1 < len(p['timeDeltas']) else 0) / 1000
for fn in fns:
    agg = {}
    for nid, t in self.items():
        if by[nid]['callFrame']['functionName'] != fn:
            continue
        chain, x = [], par.get(nid)
        while x and len(chain) < 5:
            cf = by[x]['callFrame']
            chain.append(f"{cf['functionName']}:{cf['lineNumber'] + 1}@{cf['url'].split('/')[-1]}")
            x = par.get(x)
        k = ' < '.join(chain)
        agg[k] = agg.get(k, 0) + t
    for k, v in sorted(agg.items(), key=lambda z: -z[1])[:4]:
        if v >= 5:
            print(fn, round(v), 'ms', k)
