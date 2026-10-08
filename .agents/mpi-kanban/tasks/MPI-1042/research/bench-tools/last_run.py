import json, urllib.request, urllib.parse, sys, os
# Read the bench's most recent MPI-1042 runs from :8188 history (read-only) and save their images.
OUT = sys.argv[1]  # a scratch dir, never the repo
os.makedirs(OUT, exist_ok=True)
h = json.load(urllib.request.urlopen('http://127.0.0.1:8188/history?max_items=6', timeout=10))
for pid, rec in list(h.items())[-6:]:
    prompt = rec['prompt'][2]
    titles = {k: v.get('_meta', {}).get('title', '') for k, v in prompt.items()}
    if 'Prompt_No_Body' not in titles.values():
        continue
    loads = {titles[k]: v['inputs'].get('image') or v['inputs'].get('string') for k, v in prompt.items() if v['class_type'] == 'MpiLoadImage'}
    seed = next((v['inputs']['int'] for k, v in prompt.items() if titles[k] == 'Input_Seed'), None)
    user = next((v['inputs']['value'] for k, v in prompt.items() if titles[k] == 'Input_Positive'), None)
    print('run', pid[:8], 'status', rec.get('status', {}).get('status_str'), 'loads', loads, 'seed', seed, 'user', repr(user))
    for nid, o in rec.get('outputs', {}).items():
        for im in o.get('images', []):
            q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
            dst = f"{OUT}/{pid[:8]}_{titles.get(nid, nid).replace(' ', '_').replace(':', '')}.png"
            urllib.request.urlretrieve('http://127.0.0.1:8188/view?' + q, dst)
            print('  saved', dst)
        if 'text' in o:
            print('  prompt text:', o['text'][0][:300] if isinstance(o['text'], list) else o['text'])
