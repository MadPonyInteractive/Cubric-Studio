import subprocess, sys, json
# usage: convert.py <litegraph.json> <api_out.json>   (runs the repo's converter, no shell redirect)
r = subprocess.run(['node', 'scripts/workflow-to-api.mjs', sys.argv[1]], capture_output=True, text=True, encoding='utf-8')
print('exit', r.returncode, r.stderr[-2000:])
api = json.loads(r.stdout)
open(sys.argv[2], 'w', encoding='utf-8').write(json.dumps(api, indent=1))
for k, v in sorted(api.items(), key=lambda kv: int(kv[0])):
    ins = {a: b for a, b in v['inputs'].items()}
    s = json.dumps(ins)
    print(k, v['class_type'], v.get('_meta', {}).get('title', ''), '|', s[:230])
