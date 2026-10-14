# MPI-1142: every :3000 request started in a time window (seconds from the HAR's first :3000 request).
# usage: python harwin.py <file.har> <from s> <to s>
import json, sys
from datetime import datetime

h = json.load(open(sys.argv[1], encoding='utf-8'))
ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
E = sorted((e for e in h['log']['entries'] if ':3000' in e['request']['url']), key=lambda e: ts(e['startedDateTime']))
t0 = ts(E[0]['startedDateTime'])
a, b = float(sys.argv[2]), float(sys.argv[3])
for e in E:
    s = ts(e['startedDateTime']) - t0
    if a <= s <= b:
        t = e['timings']
        print(f"{s:8.2f} +{e['time']:7.0f} q={t.get('blocked', -1):7.0f} conn={e.get('_connectionId', '-'):>5} st={e['response']['status']} "
              f"{e['response'].get('_error') or ''} {e.get('_resourceType', '')} {e['request'].get('method')} "
              f"range={next((x['value'] for x in e['request']['headers'] if x['name'].lower() == 'range'), '')} "
              f"{e['request']['url'].split(':3000', 1)[1][-80:]}")
