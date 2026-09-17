"""Survey every Vision workflow for the MpiNodes 1.2.13-1.2.15 changes (MPI-800).

API JSON: comfy_workflows/*.json + scripts/workflow_generation/*_template.json
LiteGraph: comfy_workflows/raw/*.json (node types + widgets only)
"""
import json, os, re, sys, glob
from collections import Counter, defaultdict

ROOT = r'C:\AI\Mpi\Cubric-Vision\comfy_workflows'
LOADERS = {'MpiLoadImageFromPath': 4, 'MpiLoadVideo': 8, 'MpiLoadAudio': 1,
           'MpiLoadImage': None, 'MpiLoadVideoUpload': None, 'MpiLoadAudioUpload': None}
PATHY = set(LOADERS) | {'MpiHasAudio', 'MpiStageLatents', 'MpiSaveLatent', 'MpiLoadLatent',
                        'MpiJsonLoad', 'MpiJsonSave', 'MpiBatchTextReplace', 'MpiBrushTrain',
                        'MpiRandPromptGen', 'MpiRandPromptGenSave', 'VHS_LoadVideoPath', 'LoadImage',
                        'LoadAudio', 'LoadVideo', 'VHS_LoadVideo', 'VHS_LoadAudio', 'VHS_LoadAudioUpload',
                        'LoadLatent', 'SaveLatent'}
ABS = re.compile(r'^([A-Za-z]:[\\/]|/|\\\\)')
VERBOSE = '-v' in sys.argv


def is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[1], int)


def api(path):
    wf = json.load(open(path, encoding='utf-8'))
    if not isinstance(wf, dict) or 'nodes' in wf:
        return None
    cons = defaultdict(list)  # (src, slot) -> [(dst, input)]
    for nid, n in wf.items():
        if not isinstance(n, dict):
            continue
        for k, v in (n.get('inputs') or {}).items():
            if is_link(v):
                cons[(str(v[0]), v[1])].append((nid, k))
    out = {'classes': Counter(), 'checkers': [], 'abs': [], 'unwired_upload': []}
    for nid, n in wf.items():
        if not isinstance(n, dict):
            continue
        ct = n.get('class_type')
        title = (n.get('_meta') or {}).get('title', '')
        if ct in PATHY:
            out['classes'][ct] += 1
        for k, v in (n.get('inputs') or {}).items():
            if isinstance(v, str) and ABS.match(v.strip().strip('"')) and len(v) > 3:
                out['abs'].append(f'{nid}:{ct}:{title}.{k}={v}')
        if ct in ('MpiLoadImage', 'MpiLoadVideoUpload', 'MpiLoadAudioUpload') and not is_link((n.get('inputs') or {}).get('string')):
            out['unwired_upload'].append(f'{nid}:{ct}:{title}')
        if ct == 'MpiAnyChecker':
            src = (n.get('inputs') or {}).get('any')
            src_desc = None
            if is_link(src):
                s = wf.get(str(src[0]), {})
                src_desc = f"{src[0]}:{s.get('class_type')}:{(s.get('_meta') or {}).get('title','')}"
            pass_to = [(d, k, wf[d]['class_type']) for d, k in cons[(nid, 0)]]
            has_to = [(d, k, wf[d]['class_type'], wf[d].get('_meta', {}).get('title', '')) for d, k in cons[(nid, 1)]]
            # does the checked value also reach a loader (directly or via passthrough)?
            sibling_loaders = []
            if is_link(src):
                sibling_loaders = [(d, k, wf[d]['class_type']) for d, k in cons[(str(src[0]), src[1])]
                                   if wf[d]['class_type'] in PATHY]
            feeds_loader = any(c in PATHY for _, _, c in pass_to) or bool(sibling_loaders)
            out['checkers'].append({'id': nid, 'src': src_desc, 'pass_to': pass_to, 'has_to': has_to,
                                    'sib': sibling_loaders, 'loader_gate': feeds_loader})
    return out


def raw(path):
    wf = json.load(open(path, encoding='utf-8'))
    if not isinstance(wf, dict) or 'nodes' not in wf:
        return None
    out = {'classes': Counter(), 'abs': [], 'checkers': 0}
    nodes = list(wf.get('nodes', []))
    for sg in (wf.get('definitions') or {}).get('subgraphs', []) or []:
        nodes += sg.get('nodes', [])
    for n in nodes:
        ct = n.get('type')
        if ct in PATHY:
            out['classes'][ct] += 1
        if ct == 'MpiAnyChecker':
            out['checkers'] += 1
        wv = n.get('widgets_values')
        vals = wv.values() if isinstance(wv, dict) else (wv or [])
        for v in vals:
            if isinstance(v, str) and ABS.match(v.strip().strip('"')) and len(v) > 3:
                out['abs'].append(f"{n.get('id')}:{ct}:{n.get('title','')}={v}")
            if isinstance(v, dict):
                for vv in v.values():
                    if isinstance(vv, str) and ABS.match(vv) and len(vv) > 3:
                        out['abs'].append(f"{n.get('id')}:{ct}:{n.get('title','')}={vv}")
    return out


def main():
    files = sorted(glob.glob(os.path.join(ROOT, '*.json'))) + \
        sorted(glob.glob(os.path.join(ROOT, 'scripts', 'workflow_generation', '*_template.json'))) + \
        sorted(glob.glob(os.path.join(ROOT, 'scripts', '*.json')))
    tot = Counter()
    for f in files:
        r = api(f)
        rel = os.path.relpath(f, ROOT)
        if r is None:
            print('!! not API:', rel); continue
        tot.update(r['classes'])
        gates = [c for c in r['checkers'] if c['loader_gate']]
        flag = ''
        if gates: flag += f' LOADER-GATES={len(gates)}'
        if r['abs']: flag += f' ABS={len(r["abs"])}'
        if r['unwired_upload']: flag += f' UNWIRED-UPLOAD={r["unwired_upload"]}'
        print(f'{rel}: {dict(r["classes"])} checkers={len(r["checkers"])}{flag}')
        if VERBOSE:
            for c in r['checkers']:
                print('   chk', c)
        for a in r['abs']:
            print('   ABS', a)
    print('API totals', dict(tot))
    print('--- raw ---')
    for f in sorted(glob.glob(os.path.join(ROOT, 'raw', '*.json'))):
        r = raw(f)
        rel = os.path.relpath(f, ROOT)
        if r is None:
            print('!! not LiteGraph:', rel); continue
        print(f'{rel}: {dict(r["classes"])} checkers={r["checkers"]}' + (f' ABS={len(r["abs"])}' if r['abs'] else ''))
        for a in r['abs']:
            print('   ABS', a)


main()
