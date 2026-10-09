# MPI-1036: get the Flow's graphs into comfy_workflows/raw/ as LiteGraph. No API->LiteGraph converter exists, so the
# bench FRONTEND does it: `push` puts each API prompt in ComfyUI's userdata, the browser runs, per NAME,
#   app.loadApiJson(await (await fetch('/api/userdata/workflows%2Fmpi1036%2FNAME_api.json')).json())
#   then POSTs app.graph.serialize() back as workflows/mpi1036/NAME.json,
# and `pull` copies those into comfy_workflows/raw/NAME.json, checking every titled node survived.
#   python export_raw.py push | pull
# Two graphs since Video edit 12 (Fabio, 2026-10-09: "the app picks the correct one", universal_workflows.js byParams):
# the whole frame on our two-stage H3 graph, the masked route ("Only change" typed) on the single pass.
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flow_graph as fg  # noqa: E402
import flow_graph_ours as fgo  # noqa: E402

URL = 'http://127.0.0.1:8188/api/userdata/workflows%2Fmpi1036%2F'
RAW = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '..', 'comfy_workflows', 'raw')


def whole():
    g = fgo.graph()
    # The shipped graph's stage-1 preview save and the two decodes that only feed it: a Flow run is never
    # preview-only (commandExecutor captures Output_Preview only then), so they cost a decode and a file per run.
    for k in ('574', '570', '571'):
        del g[k]
    for k, n in g.items():
        for v in n['inputs'].values():
            assert not (isinstance(v, list) and len(v) == 2 and v[0] in ('574', '570', '571')), (k, v)
    return g


# INTERIM (Video edit 12, 2026-10-09): `whole` (ours, two stages) REPLAYS the clip ~1 s in - H3 loses the moves when it
# renders below ~full size, and ours' stage 1 is half size. Both files are the single pass until the fix (the clip
# handed in at 0.75, S5s75/S4x) is built into flow_graph and the Flow is one graph again (plan.md Current State).
GRAPHS = {'flow_video_edit': fg.graph, 'flow_video_edit_masked': fg.graph}

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
