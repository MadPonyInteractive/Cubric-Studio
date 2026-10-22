"""Pick the 2 newest past runs per Flow with DIFFERENT source pictures -> inputs.json.
Each entry keeps what a replay needs: the sidecar, flowInputs (media + step values), prompt, seed."""
import json, os, glob
DOCS = os.path.expandvars(r'%USERPROFILE%\Documents\Cubric Studio')
reg = json.load(open(os.path.join(DOCS, 'project-paths.json'), encoding='utf-8'))
paths = reg.get('paths', reg) if isinstance(reg, dict) else reg
roots = set(p for p in paths if isinstance(p, str)) | set(glob.glob(os.path.join(DOCS, 'Projects', '*')))
WANT = ['scribble-object', 'scribble', 'outpaint', 'make-seamless', 'object-stamp',
        'character-sheet-editor', 'character-sheet-from-images']
runs = {f: [] for f in WANT}
seen = set()
for r in roots:
    for m in glob.glob(os.path.join(r, 'Media', '.meta', '*.json')):
        m = os.path.normcase(os.path.abspath(m))
        if m in seen:
            continue
        seen.add(m)
        try:
            d = json.load(open(m, encoding='utf-8'))
        except Exception:
            continue
        if d.get('flowId') in runs:
            runs[d['flowId']].append((os.path.getmtime(m), m, d))
picked = {}
for f in WANT:
    out, srcs = [], set()
    for _, m, d in sorted(runs[f], key=lambda x: x[0], reverse=True):
        media = [x.get('url') for x in (d.get('flowInputs') or {}).get('mediaItems', [])]
        key = tuple(sorted(str(u).split('&v=')[0] for u in media))
        if key in srcs:
            continue
        srcs.add(key)
        out.append({'sidecar': m, 'output': d.get('displayName'), 'prompt': d.get('prompt'),
                    'seed': d.get('seed'), 'media': [str(u).split('&v=')[0] for u in media],
                    'flowModelIds': (d.get('generationSettings') or {}).get('flowModelIds'),
                    'createdAt': d.get('createdAt')})
        if len(out) == 2:
            break
    picked[f] = out
    print(f, len(runs[f]), 'runs ->', [(o['output'], (o['prompt'] or '')[:50]) for o in out])
json.dump(picked, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inputs.json'), 'w', encoding='utf-8'),
          indent=1, ensure_ascii=False)
