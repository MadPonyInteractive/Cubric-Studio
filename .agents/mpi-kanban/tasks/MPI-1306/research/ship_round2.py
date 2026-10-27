"""MPI-1306 iteration 4, round 2 (research/closeup2.jpg): Sheet_Prompt_With_Body_Other = MERGE_WB, and the OTHER
layout's close-up = CHEST_CU. Sets both nodes in the runtime graph and the raw twin (widgets_values[0])."""
import io, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
src = io.open(HERE + '/bench.py', encoding='utf-8').read()
ns = {}
exec(src[src.index('MERGE_WB = '):src.index("if sys.argv[1] == 'closeup2'")], ns)
ROOT = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
NAME = 'flow_character_sheet_from_images.json'
api = json.load(open(ROOT + NAME, encoding='utf-8'))
by = {n['_meta'].get('title'): n for n in api.values()}
lo = by['Sheet_Prompt_Other']['inputs']['value']
new = {'Sheet_Prompt_With_Body_Other': ns['MERGE_WB'],
       'Sheet_Prompt_Other': lo[:lo.index('The right half')] + ns['CHEST_CU'] + ' ' + lo[lo.index('The left half'):]}
for p, get in ((ROOT + NAME, lambda t: by[t]['inputs']['value']),
               (ROOT + 'raw/' + NAME, None)):
    txt = io.open(p, encoding='utf-8', newline='').read()
    for t, v in new.items():
        old = json.dumps(by[t]['inputs']['value'] if t != 'Sheet_Prompt_Other' else lo, ensure_ascii=False)
        assert txt.count(old) == 1, (p, t)
        txt = txt.replace(old, json.dumps(v, ensure_ascii=False))
    io.open(p, 'w', encoding='utf-8', newline='').write(txt)
g = json.load(open(ROOT + NAME, encoding='utf-8'))
r = json.load(open(ROOT + 'raw/' + NAME, encoding='utf-8'))
for t, v in new.items():
    assert next(n for n in g.values() if n['_meta'].get('title') == t)['inputs']['value'] == v
    assert next(n for n in r['nodes'] if n.get('title') == t)['widgets_values'][0] == v
print('shipped')
