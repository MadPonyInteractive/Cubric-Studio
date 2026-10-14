"""MPI-1086 r26 finding: MpiClearVram is an OUTPUT_NODE, so ComfyUI ALWAYS runs it - and node 156 ("free Klein before
Qwen loads") pulled the whole Klein mannequin leg into EVERY Qwen run (Body shape, a given mannequin), ~20 s and 9 GB.
Feed it from the gate (165, MpiIfElseInverted out_b): the mannequin when it was built, else an ExecutionBlocker, and a
blocked output node is skipped. usage: patch_raw_clearvram.py (then convert the Qwen file alone)
"""
import json

P = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
raw = open(P, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
assert by[156]['type'] == 'MpiClearVram' and by[165]['type'] == 'MpiIfElseInverted' and by[155]['type'] == 'VAEDecode'
inp = next(i for i in by[156]['inputs'] if i['name'] == 'passthrough')
link = next(l for l in r['links'] if l[0] == inp['link'])
if link[1] == 165:
    raise SystemExit('already patched')
assert link[1:3] == [155, 0], link
by[155]['outputs'][0]['links'].remove(link[0])
link[1], link[2] = 165, 1
by[165]['outputs'][1]['links'] = (by[165]['outputs'][1].get('links') or []) + [link[0]]
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(P, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print('156 passthrough <- 165 out_b')
