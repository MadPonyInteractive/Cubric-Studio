import json, sys
d = json.load(open(sys.argv[1]))
full = len(sys.argv) > 2
print('target', d['target'], 'tag', d['tag'], '| nvsmi start', d['nvsmiStart'], 'end', d['nvsmiEnd'])
if d.get('error'): print('ERROR', d['error'][:800])
for k, v in d['steps'].items():
    if k.startswith('mem'):
        print(f"{k:18} gpuDed {v['gpuDedicatedMB']} MB | priv " + ' '.join(f"{p}={x['privMB']}" for p, x in v['procs'].items()) + f" | nvsmi {v['nvsmi']}")
    elif isinstance(v, dict) and 'cpuTop' in v:
        top = v.pop('cpuTop')
        rows = v.pop('rows', None)
        print(f"{k:18} {json.dumps(v)}")
        for t in top[: (12 if full else 6)]: print('      ', t)
        if rows: print('       rows:', [(r['w'], r['c']) for r in rows])
    elif isinstance(v, list):
        print(f"{k:18}", ' | '.join(f"{x['meanFps']}fps med {x['medMs']} p95 {x['p95Ms']} max {x['maxMs']}" + (f" s {x.get('scale0')}->{x.get('scaleMax')}" if 'scale0' in x else '') + (f" moved {x.get('offsetMoved')}" if 'offsetMoved' in x else '') for x in v))
    else:
        print(f"{k:18} {json.dumps(v)[:500]}")
print('console', d['consoleErrors'][:6])
print('pageErr', d['pageErrors'][:6])
