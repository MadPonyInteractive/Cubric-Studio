"""Copy the Big Photos Test project into the perf scratch Documents root and rewrite
every absolute path in project.json + Media/.meta/*.json to the copy, so the rig's
instance never reads or writes Fabio's fixture."""
import json, os, shutil, sys
from urllib.parse import quote

SRC = r'C:\Users\Fabio\Documents\Cubric Vision\Projects\Big Photos Test'
ROOT = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(ROOT, 'docs', 'Cubric Vision', 'Projects', 'Big Photos Test')

if not os.path.exists(DST):
    shutil.copytree(SRC, DST)

pairs = [
    (quote(SRC, safe=''), quote(DST, safe='')),
    (SRC.replace('\\', '/'), DST.replace('\\', '/')),
    (SRC.replace('\\', '\\\\'), DST.replace('\\', '\\\\')),
]
files = [os.path.join(DST, 'project.json')] + [
    os.path.join(DST, 'Media', '.meta', f) for f in os.listdir(os.path.join(DST, 'Media', '.meta')) if f.endswith('.json')]
n = 0
for f in files:
    s = open(f, encoding='utf-8').read()
    t = s
    for a, b in pairs:
        t = t.replace(a, b)
    json.loads(t)
    assert SRC.replace('\\', '/') not in t and quote(SRC, safe='') not in t, f
    if t != s:
        open(f, 'w', encoding='utf-8', newline='').write(t)
        n += 1
print('copy at', DST, '| files rewritten:', n)
