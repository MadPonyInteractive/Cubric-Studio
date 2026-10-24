"""Trace a raw: trace.py <path> up|down <node id> [depth] ; or 'title <text>' to find nodes."""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
w = json.load(open(sys.argv[1], encoding='utf8'))
N = {n['id']: n for n in w['nodes']}; L = {l[0]: l for l in w['links']}
nm = lambda i: f"{i} {N[i]['type']} '{N[i].get('title') or ''}' w={N[i].get('widgets_values') if not isinstance(N[i].get('widgets_values'), list) or len(str(N[i].get('widgets_values')))<120 else '...'}"
mode = sys.argv[2]
if mode == 'title':
    for n in w['nodes']:
        if sys.argv[3].lower() in (n.get('title') or '').lower() or sys.argv[3].lower() in n['type'].lower() or sys.argv[3] in str(n.get('widgets_values')):
            print(nm(n['id']))
    sys.exit()
start, depth = int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 3
def up(i, d, pre=''):
    for x in N[i].get('inputs', []):
        if x.get('link') is None: continue
        s = L[x['link']][1]
        print(f"{pre}{x['name']} <- {nm(s)}")
        if d > 1: up(s, d - 1, pre + '    ')
def down(i, d, pre=''):
    for o in N[i].get('outputs', []):
        for lid in o.get('links') or []:
            t = L[lid][3]; tin = [x['name'] for x in N[t]['inputs'] if x.get('link') == lid]
            print(f"{pre}{o['name']} -> {nm(t)}.{tin}")
            if d > 1: down(t, d - 1, pre + '    ')
print(nm(start)); (up if mode == 'up' else down)(start, depth)
