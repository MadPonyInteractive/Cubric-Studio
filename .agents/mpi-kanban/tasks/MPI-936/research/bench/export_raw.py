# MPI-936: get graph.py into comfy_workflows/raw/ as LiteGraph (same route as MPI-1036's export_raw.py). No
# API->LiteGraph converter exists, so the bench FRONTEND does it: `push` puts the API prompt in ComfyUI's userdata,
# the bench tab runs
#   app.loadApiJson(await (await fetch('/api/userdata/workflows%2Fmpi936%2Fqwen_image_2_1_api.json')).json())
# then POSTs app.graph.serialize() back as workflows/mpi936/qwen_image_2_1.json, and `pull` copies that into
# comfy_workflows/raw/qwen_image_2_1.json, checking every titled node survived.
#   python export_raw.py push | pull
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import graph as qg  # noqa: E402

URL = 'http://127.0.0.1:8188/api/userdata/workflows%2Fmpi936%2F'
RAW = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'raw',
                   'qwen_image_2_1.json')
# The template's baked defaults: an empty Input_Image, so the raw graph opens as t2i.
API = qg.graph('A glossy red apple with one green leaf, product shot, transparent background, alpha channel.')

if sys.argv[1] == 'push':
    req = urllib.request.Request(URL + 'qwen_image_2_1_api.json?overwrite=true', method='POST',
                                 data=json.dumps(API).encode(), headers={'Content-Type': 'application/json'})
    print(urllib.request.urlopen(req, timeout=30).status)
else:
    lg = json.loads(urllib.request.urlopen(URL + 'qwen_image_2_1.json', timeout=30).read())
    want = {n['_meta']['title'] for n in API.values()}
    have = {n.get('title') or n['type'] for n in lg['nodes']}
    print('nodes', len(lg['nodes']), 'links', len(lg['links']), 'missing titles', sorted(want - have) or 'none')
    with open(os.path.abspath(RAW), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lg, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('wrote', os.path.abspath(RAW))
