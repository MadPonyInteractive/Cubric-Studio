# MPI-1036: get the Flow's graphs into comfy_workflows/raw/ as LiteGraph. No API->LiteGraph converter exists, so the
# bench FRONTEND does it: `push` puts each API prompt in ComfyUI's userdata, the browser runs, per NAME,
#   app.loadApiJson(await (await fetch('/api/userdata/workflows%2Fmpi1036%2FNAME_api.json')).json())
#   then POSTs app.graph.serialize() back as workflows/mpi1036/NAME.json,
# and `pull` copies those into comfy_workflows/raw/NAME.json, checking every titled node survived.
#   python export_raw.py push | pull
# One graph (Video edit 13): the masked route's crop goes into H3 1:1, the whole frame's clip at 0.75 of the
# render size (flow_graph node 42). Ours (two stages) is research only: its half-size stage 1 replays the clip.
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flow_graph as fg  # noqa: E402

URL = 'http://127.0.0.1:8188/api/userdata/workflows%2Fmpi1036%2F'
RAW = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'raw')
GRAPHS = {'flow_video_edit': fg.graph}

if sys.argv[1] == 'push':
    for name, build in GRAPHS.items():
        req = urllib.request.Request(URL + name + '_api.json?overwrite=true', method='POST',
                                     data=json.dumps(build()).encode(), headers={'Content-Type': 'application/json'})
        print(name, urllib.request.urlopen(req, timeout=30).status)
else:
    for name, build in GRAPHS.items():
        lg = json.loads(urllib.request.urlopen(URL + name + '.json', timeout=30).read())
        want = {n['_meta']['title'] for n in build().values()}
        have = {n.get('title') or n['type'] for n in lg['nodes']}
        print(name, 'nodes', len(lg['nodes']), 'links', len(lg['links']), 'missing titles', sorted(want - have) or 'none')
        path = os.path.abspath(os.path.join(RAW, name + '.json'))
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(lg, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print('wrote', path)
