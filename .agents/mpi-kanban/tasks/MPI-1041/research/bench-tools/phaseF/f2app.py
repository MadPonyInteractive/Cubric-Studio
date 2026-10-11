"""MPI-1041 F1 + F2 in-app cases on MY isolated instance (CUBRIC_URL), through /connector/generate.
Project = the Phase E project (session a415c2d7's APP_DOCUMENTS). Reference pictures are copied into its Media/ first.
usage: python f2app.py <case>... | all   (run under gpu_lease). One json line per case to f2app.jsonl."""
import glob, json, os, shutil, sys, time, urllib.parse, urllib.request

BASE = os.environ['CUBRIC_URL']
HERE = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
FP = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/a415c2d7-d1d5-47a5-bd43-253e3f6e1b3f/scratchpad/docs/Cubric Studio/Projects/MPI-1041 Phase E'
RESULTS = HERE + '/f2app.jsonl'
REFS = 'G:/ComfyUi/ComfyUI/input'


def sheet_url(stem):
    for f in glob.glob(FP + '/Media/.meta/*.json'):
        m = json.load(open(f, encoding='utf-8'))
        if urllib.parse.unquote(m['filePath']).split('?path=')[1].split('&')[0].endswith('\\' + stem):
            return m['filePath']
    raise SystemExit(f'no sheet {stem}')


def ref_url(name):
    dst = f'{FP}/Media/ref_{name}.png'
    if not os.path.exists(dst):
        shutil.copy(f'{REFS}/mpi1041f2_ref_{name}.png', dst)
    return '/project-file?path=' + urllib.parse.quote(dst.replace('/', '\\'))


CASES = {   # id: (sheet, change, words, age, ref)
    'f1_dress_photo': ('ava_sheet.png', 'clothes', 'a red dress with a keyhole and a long skirt', -1, None),
    'f2_dress_photo': ('ava_sheet.png', 'clothes', '', -1, 'dress'),
    'f2_hat_refused': ('fisher_sheet.png', 'accessories', '', -1, 'hat'),   # Clothes-only: no words = "Say what to change first."
    'f2_refuse_age10': ('ava_sheet.png', 'clothes', '', 10, 'dress'),
    'f2_none_age60': ('ava_sheet.png', 'none', '', 60, 'dress'),
}


def run(cid):
    sheet, change, words, age, ref = CASES[cid]
    media = [{'role': 'image1', 'url': sheet_url(sheet)}] + ([{'role': 'image2', 'url': ref_url(ref)}] if ref else [])
    body = {'flowId': 'character-sheet-editor', 'folderPath': FP,
            'fields': {'change': change, 'words': words, 'Input_Age': age}, 'media': media}
    t = time.time()
    req = urllib.request.Request(BASE + '/connector/generate', json.dumps(body).encode(), {'Content-Type': 'application/json'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=5400))
    except urllib.error.HTTPError as e:
        r = json.loads(e.read() or b'{}') or {'ok': False}
    except Exception as e:  # noqa: BLE001 - log and carry on
        r = {'ok': False, 'error': {'code': 'HTTP', 'message': str(e)}}
    r.update(case=cid, secs=round(time.time() - t), fields=body['fields'], ref=ref)
    with open(RESULTS, 'a', encoding='utf-8') as f:
        f.write(json.dumps(r) + '\n')
    out = r.get('output') or {}
    print(cid, r.get('ok'), r['secs'], 's', out.get('cardName'), out.get('filePath'), r.get('error'), flush=True)


for c in (CASES if sys.argv[1:] == ['all'] else sys.argv[1:]):
    run(c)
