"""MPI-1306 iteration 3: Sheet_Prompt_With_Body_Other copies image 1 as an established design; image 2 gives only
the build. Sets the node's value in the runtime graph and the raw twin (widgets_values[0])."""
import io, json, sys
sys.path.insert(0, 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/d2631e93-a9a0-489d-84aa-c3a3a3b8091d/scratchpad')
src = io.open(sys.path[0] + '/bench.py', encoding='utf-8').read()
ns = {}
exec(src[src.index('COPY_NB = '):src.index("if sys.argv[1] == 'fidelity'")], ns)
NEW = ns['COPY_WB']
ROOT = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
T = 'Sheet_Prompt_With_Body_Other'

p = ROOT + 'flow_character_sheet_from_images.json'
txt = io.open(p, encoding='utf-8', newline='').read()
g = json.loads(txt)
old = next(n for n in g.values() if n['_meta'].get('title') == T)['inputs']['value']
assert txt.count(json.dumps(old, ensure_ascii=False)) == 1
txt = txt.replace(json.dumps(old, ensure_ascii=False), json.dumps(NEW, ensure_ascii=False))
io.open(p, 'w', encoding='utf-8', newline='').write(txt)

p = ROOT + 'raw/flow_character_sheet_from_images.json'
txt = io.open(p, encoding='utf-8', newline='').read()
assert txt.count(json.dumps(old, ensure_ascii=False)) == 1
txt = txt.replace(json.dumps(old, ensure_ascii=False), json.dumps(NEW, ensure_ascii=False))
io.open(p, 'w', encoding='utf-8', newline='').write(txt)

for f in (ROOT + 'flow_character_sheet_from_images.json',):
    g = json.load(open(f, encoding='utf-8'))
    assert next(n for n in g.values() if n['_meta'].get('title') == T)['inputs']['value'] == NEW
r = json.load(open(ROOT + 'raw/flow_character_sheet_from_images.json', encoding='utf-8'))
assert next(n for n in r['nodes'] if n.get('title') == T)['widgets_values'][0] == NEW
print('shipped')
