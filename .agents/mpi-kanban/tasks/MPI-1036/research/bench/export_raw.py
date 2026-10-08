# MPI-1036: get flow_graph.py into comfy_workflows/raw/ as LiteGraph. No API->LiteGraph converter exists, so the
# bench FRONTEND does it: `push` puts the API prompt in ComfyUI's userdata, the browser runs
#   app.loadApiJson(await (await fetch('/api/userdata/workflows%2Fmpi1036%2Fflow_video_edit_api.json')).json())
#   then POSTs app.graph.serialize() back as workflows/mpi1036/flow_video_edit.json,
# and `pull` copies that into comfy_workflows/raw/flow_video_edit.json, checking every titled node survived.
#   python export_raw.py push | pull
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flow_graph as fg  # noqa: E402

URL = 'http://127.0.0.1:8188/api/userdata/workflows%2Fmpi1036%2F'
RAW = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'raw', 'flow_video_edit.json')

if sys.argv[1] == 'push':
    req = urllib.request.Request(URL + 'flow_video_edit_api.json?overwrite=true', method='POST',
                                 data=json.dumps(fg.graph()).encode(), headers={'Content-Type': 'application/json'})
    print(urllib.request.urlopen(req, timeout=30).status)
else:
    lg = json.loads(urllib.request.urlopen(URL + 'flow_video_edit.json', timeout=30).read())
    want = {n['_meta']['title'] for n in fg.graph().values()}
    have = {n.get('title') or n['type'] for n in lg['nodes']}
    print('nodes', len(lg['nodes']), 'links', len(lg['links']), 'missing titles', sorted(want - have) or 'none')
    with open(os.path.abspath(RAW), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lg, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('wrote', os.path.abspath(RAW))
