"""MPI-1086 r41/r42 (Fabio 2026-10-16: "same approach as the haircuts, mannequins for the makeups"): the in-graph Klein
mannequin's prompt (node 147, hair only since r19) becomes an input, `Input_Mannequin_Prompt` (MpiText, its default the
hair prompt), so the builder can ask for a makeup mannequin instead. Idempotent: refuses to run twice.
Then: COMFY_URL=http://127.0.0.1:48188 node scripts/workflow-to-api.mjs <raw> > <api>, and
node scripts/validate-injection-rules.mjs.
"""
import copy, json

PATH = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
raw = open(PATH, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'Input_Mannequin_Prompt' for n in r['nodes']):
    raise SystemExit('already patched')
MANN = 147
hair = by[MANN]['widgets_values'][0]
T = {n.get('title'): n['id'] for n in r['nodes']}

nid, lid = r['last_node_id'] + 1, r['last_link_id'] + 1
c = copy.deepcopy(by[T['Input_Positive']])
c.update({'id': nid, 'pos': [by[MANN]['pos'][0] - 440, by[MANN]['pos'][1] + 120], 'order': 300 + nid,
          'title': 'Input_Mannequin_Prompt', 'widgets_values': [hair], 'widgets_values_named': {'string': hair}})
c['inputs'][0]['link'] = None
c['outputs'][0]['links'] = [lid]
r['nodes'].append(c)
text = next(i for i in by[MANN]['inputs'] if i['name'] == 'text')
text['link'] = lid
r['links'].append([lid, nid, 0, MANN, by[MANN]['inputs'].index(text), 'STRING'])
r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(PATH, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'Input_Mannequin_Prompt = node {nid} -> {MANN}.text (default: the hair prompt)')
