"""MPI-1153: run both sheet Flows once on an ISOLATED app (npm run app:isolated, under gpu_lease) and report each
card's versions. usage: python drive.py <app url> [cs|fi ...]
Character Sheet with Headless front body OFF (the card must show the sheet, the headless version one step after);
from Images with it ON (default: the card shows the headless version)."""
import json, sys, urllib.request
from PIL import Image

URL = sys.argv[1].rstrip('/')
ONLY = sys.argv[2:] or ['cs', 'fi']
FACE = 'G:/ComfyUi/ComfyUI/input/mpi1042_threequarter_4x5.png'


def post(path, body, timeout=60):
    req = urllib.request.Request(URL + path, json.dumps(body).encode(), {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


projects = post('/list-projects', {}).get('projects', [])
proj = next((p for p in projects if p.get('name') == 'MPI-1153 probe'), None)
if not proj:
    proj = post('/create-project', {'name': 'MPI-1153 probe'})['project']
folder = proj['folderPath']
print('project', folder)

if 'cs' in ONLY:
    res = post('/connector/generate', {'flowId': 'character-sheet', 'folderPath': folder, 'cardName': 'cs probe',
                                       'fields': {'positive': 'a weathered sea captain in a navy wool coat and a knitted cap',
                                                  'Input_Positive': 'A weathered sea captain in his fifties, grey beard, navy wool pea coat, knitted cap, dark trousers, leather boots.',
                                                  'Input_is_Turbo': True, 'Input_Quality': 1, 'Input_Remove_Head': False}},
               timeout=1800)
    print('cs', json.dumps(res)[:600])

if 'fi' in ONLY:
    from urllib.parse import quote
    pid = proj.get('id')
    staged = post(f'/project-media/{pid}/place-preview-asset?folderPath={quote(folder)}', {'dataUrl': FACE, 'ext': '.png'})
    w, h = Image.open(FACE).size
    res = post('/connector/generate', {'flowId': 'character-sheet-from-images', 'folderPath': folder, 'cardName': 'fi probe',
                                       'media': [{'role': 'image1', 'url': staged['filePath']}],
                                       'params': {'box1': {'x': 0, 'y': 0, 'width': w, 'height': h}}},
               timeout=1800)
    print('fi', json.dumps(res)[:600])

if 'ed' in ONLY:
    # The Sheet Editor at Age 10 runs the from-images graph as its rebuild leg with Input_Headless off: that leg
    # must land ONE version (no head removal of its own), then leg 4 removes the head on the rebuilt sheet.
    pj = json.load(open(folder + '/project.json', encoding='utf-8'))
    cs = next(g for g in pj['itemGroups'] if g.get('customName') == 'cs probe')
    meta = json.load(open(f'{folder}/Media/.meta/{cs["history"][0]}.json', encoding='utf-8'))
    res = post('/connector/generate', {'flowId': 'character-sheet-editor', 'folderPath': folder, 'cardName': 'ed probe',
                                       'media': [{'role': 'image1', 'url': meta['filePath']}],
                                       'fields': {'change': 'none', 'Input_Age': 10}},
               timeout=3600)
    print('ed', json.dumps(res)[:600])

pj = json.load(open(folder + '/project.json', encoding='utf-8'))
for g in pj.get('itemGroups', []):
    if g.get('customName') in ('cs probe', 'fi probe', 'ed probe'):
        ops = [json.load(open(f'{folder}/Media/.meta/{i}.json', encoding='utf-8')).get('operation') for i in g['history']]
        print(g['customName'], 'selectedIndex', g.get('selectedIndex'), ops)
