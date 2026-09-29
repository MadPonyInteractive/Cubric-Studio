"""Summarise mask-mode rig runs: python msum.py <run dir or result.json> ..."""
import json, os, sys

for a in sys.argv[1:]:
    p = a if a.endswith('.json') else os.path.join(a, 'result.json')
    R = json.load(open(p, encoding='utf-8'))
    S = R.get('steps', {})
    print('==', os.path.basename(os.path.dirname(p)), '| edge', R.get('maskEdge'), '| routeHits', R.get('routeHits'),
          '| reload', R.get('reloadedForRoute'), '| nvsmi', R.get('nvsmiStart'), '->', R.get('nvsmiEnd'))
    if R.get('error'): print('  ERROR', R['error'][:600])
    print('  open visibleMs', (S.get('open') or {}).get('visibleMs'), '| dims', S.get('maskDims'))
    for i, r in enumerate(S.get('stroke') or []):
        print(f"  stroke{i}: {r['meanFps']} fps med {r['medMs']} p95 {r['p95Ms']} max {r['maxMs']} | longtask {r['longtaskMs']} ms | top {r['cpuTop'][:3]}")
    h = S.get('holeFill')
    if h: print('  holeFill', {k: h[k] for k in h if k != 'cpuTop'})
    ad = S.get('adjust')
    if ad:
        d = ad.pop('drag')
        print('  adjust', ad)
        print('  adjust drag', d)
    for k in ('switchToPaint', 'switchToPrompt', 'switchPromptToMask'):
        s = S.get(k)
        if s: print(f"  {k}: ready {s['readyMs']} frame {s['frameMs']} longtask {s['longtaskMs']} max {s['longtaskMax']} | {s['cpuTop'][:3]}")
    for k in ('maskBeforePrompt', 'maskAfterRoundTrip'):
        if S.get(k): print(' ', k, S[k])
    for k in ('memMask', 'memMask2'):
        m = S.get(k)
        if m: print(f"  {k}: gpuDed {m['gpuDedicatedMB']} MB | tab priv {m['procs'].get('Tab', {}).get('privMB')} | gpu priv {m['procs'].get('GPU', {}).get('privMB')} | {m['nvsmi']}")
    if R.get('pageErrors'): print('  pageErrors', R['pageErrors'][:3])
