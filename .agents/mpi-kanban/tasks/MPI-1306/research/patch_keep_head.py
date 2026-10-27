"""MPI-1306 iteration 4: for a character that is not a person, picture 2 goes in WHOLE. SAM3 head removal cut a
mascot's neck and most of its body away (research/headonly.jpg), so the sheet invented long human legs. The MpiIfElse
is lazy, so the removal does not even run for OTHER. Sheet_Prompt_With_Body_Other becomes KEEP_WB (bench.py).
usage: python patch_keep_head.py [closeup]   closeup = also ship HEAD_CU into Sheet_Prompt_Other.
Patches the raw graph and its runtime twin together; refuses to run twice."""
import io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = io.open(HERE + '/bench.py', encoding='utf-8').read()
ns = {}
exec(src[src.index('COPY_NB = '):src.index("if sys.argv[1] == 'headonly'")], ns)
exec(src[src.index('HEAD_CU = '):src.index("if sys.argv[1] == 'closeup'")], ns)
pg = io.open(HERE + '/patch_other.py', encoding='utf-8').read()
exec('import copy, json\nROOT = ' + repr('C:/AI/Mpi/Cubric-Vision/comfy_workflows/') + '\nNAME = '
     + repr('flow_character_sheet_from_images.json') + '\n' + pg[pg.index('class Graph'):pg.index('g = Graph()')], ns)


class Patch(ns['Graph']):
    def __init__(self):  # the parent refuses an already-OTHER graph; this one refuses only itself
        self.raw = open(ns['ROOT'] + 'raw/' + ns['NAME'], 'rb').read().decode('utf-8')
        self.r = json.loads(self.raw)
        self.api = json.load(open(ns['ROOT'] + ns['NAME'], encoding='utf-8'))
        self.by = {n['id']: n for n in self.r['nodes']}
        self.nid, self.lid = self.r['last_node_id'], self.r['last_link_id']
        if any(n.get('title') == 'picture 2 whole, when not a person' for n in self.r['nodes']):
            raise SystemExit('already patched')

    def set_value(self, title, value):
        n = next(n for n in self.r['nodes'] if n.get('title') == title)
        n['widgets_values'][0] = value
        self.set_api(n['id'], 'value', value)


g = Patch()
# 102 is an MpiIfElse already keyed on "not a person?" (95): clone it for picture 2.
whole = g.clone(102, 'picture 2 whole, when not a person', [1060, 400], [True])
g.wire(28, 0, whole, 'true')
g.wire(37, 0, whole, 'false')
g.wire(95, 0, whole, 'boolean')
g.wire(whole, 0, 42, 'on_true')
g.set_value('Sheet_Prompt_With_Body_Other', ns['KEEP_WB'])
if 'closeup' in sys.argv[1:]:
    lo = next(n for n in g.r['nodes'] if n.get('title') == 'Sheet_Prompt_Other')['widgets_values'][0]
    a, b = lo.index('The right half'), lo.index('The left half')
    g.set_value('Sheet_Prompt_Other', lo[:a] + ns['HEAD_CU'] + ' ' + lo[b:])

for nid, n in g.api.items():
    for v in n['inputs'].values():
        if isinstance(v, list):
            assert v[0] in g.api, (nid, v)
g.save()
print('patched', whole)
