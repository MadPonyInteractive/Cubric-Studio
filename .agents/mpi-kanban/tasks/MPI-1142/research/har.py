import json, sys
from datetime import datetime
h = json.load(open(sys.argv[1], encoding='utf-8'))
E = h['log']['entries']
def ts(s): return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
E.sort(key=lambda e: ts(e['startedDateTime']))
t0 = ts(E[0]['startedDateTime'])
print(len(E), E[0]['startedDateTime'], E[-1]['startedDateTime'])
for e in E:
    t = e['timings']; r = e['response']
    u = e['request']['url'].replace('http://127.0.0.1:3000', '')[:100]
    print(f"{ts(e['startedDateTime'])-t0:7.2f} {e['time']:8.0f} st={r['status']} q={t.get('_blocked_queueing',-1):7.0f} bl={t.get('blocked',-1):7.0f} c={t.get('connect',-1):5.0f} w={t.get('wait',-1):7.0f} rx={t.get('receive',-1):6.0f} conn={e.get('connection','-'):>6} {r.get('_error','') or ''} {e.get('_resourceType','')} {u}")
