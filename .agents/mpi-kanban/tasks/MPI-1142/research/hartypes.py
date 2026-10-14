# MPI-1142: which kinds of :3000 loads queued > 5 s, and which never did.
# usage: python hartypes.py <file.har>
import json, sys
from collections import Counter

h = json.load(open(sys.argv[1], encoding='utf-8'))
E = [e for e in h['log']['entries'] if ':3000' in e['request']['url']]
slow = Counter(e.get('_resourceType', '') for e in E if e['timings'].get('blocked', 0) > 5000)
every = Counter(e.get('_resourceType', '') for e in E)
for k, n in every.most_common():
    print(f"{k or '(none)':12} total={n:4} queued>5s={slow.get(k, 0)}")
for e in E:
    if e['timings'].get('blocked', 0) > 5000 and e.get('_resourceType') != 'media':
        print('non-media slow:', e.get('_resourceType'), e['_initiator'].get('type'), e['request']['url'][-70:])
