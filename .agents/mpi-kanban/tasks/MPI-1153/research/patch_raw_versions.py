"""MPI-1153 (Fabio, 2026-10-16): Character Sheet and Character Sheet from Images remove the head IN their own graph,
like the Character Sheet Editor (MPI-1086 research/bench/patch_raw_versions.py, whose cloning this copies).

Each graph gets the nodes of raw/flow_character_sheet_headless.json, cloned after the sheet, ending in
`Output_Image_2` (the app files it under flowCharacterSheetHeadless: commandRegistry `outputVersions`).
  * Character Sheet: always (Headless front body only picks the version shown). Its own SAM3 loader is cloned.
  * from Images: behind an MpiIfElseInverted gate on `Input_Headless` (default on), because the Sheet Editor's
    child-rebuild leg runs this graph mid-chain and must not remove the head there (it passes false). Reuses the
    graph's SAM3 loader (node 29).
The runtime (API) twin is patched the same way from flow_character_sheet_headless's API nodes, so no engine is
needed; `node scripts/workflow-to-api.mjs <raw>` against a live engine must give the same JSON (checked).
Idempotent: refuses to run twice.
usage: python patch_raw_versions.py
"""
import copy, json

ROOT = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
RAW = ROOT + 'raw/'
_hl = json.load(open(RAW + 'flow_character_sheet_headless.json', encoding='utf-8'))
HL, HL_LINKS = {n['id']: n for n in _hl['nodes']}, _hl['links']
HL_API = json.load(open(ROOT + 'flow_character_sheet_headless.json', encoding='utf-8'))
_ed = {n['id']: n for n in json.load(open(RAW + 'flow_character_sheet_edit.json', encoding='utf-8'))['nodes']}
SIZE, FLAG, INVERTED = _ed[43], _ed[104], _ed[105]  # GetImageSize, MpiSimpleBoolean, MpiIfElseInverted


class Graph:
    def __init__(self, name):
        self.name = name
        self.raw = open(RAW + name, 'rb').read().decode('utf-8')
        self.r = json.loads(self.raw)
        self.api = json.load(open(ROOT + name, encoding='utf-8'))
        self.by = {n['id']: n for n in self.r['nodes']}
        self.nid, self.lid = self.r['last_node_id'], self.r['last_link_id']
        if any(n.get('title') == 'Output_Image_2' for n in self.r['nodes']):
            raise SystemExit(f'{name}: already patched')

    def clone(self, n, title, pos, widgets=None, api=None):
        self.nid += 1
        c = copy.deepcopy(n)
        c.update({'id': self.nid, 'pos': pos, 'order': 100 + self.nid, 'mode': 0})
        if title is None:
            c.pop('title', None)
        else:
            c['title'] = title
        for i in c.get('inputs', []):
            i['link'] = None
        for o in c.get('outputs', []):
            o['links'] = []
        if widgets is not None:
            c['widgets_values'] = widgets
        c.pop('widgets_values_named', None)
        self.r['nodes'].append(c)
        self.by[self.nid] = c
        a = copy.deepcopy(api)
        if title:  # an untitled node keeps its display name, as the converter writes it
            a['_meta']['title'] = title
        self.api[str(self.nid)] = a
        return self.nid

    def wire(self, src, sslot, dst, dname, api_src=None):
        """Raw link src:sslot -> dst.dname; the API input takes `api_src` (a resolved [id, slot]) or the same."""
        i = next(i for i in self.by[dst]['inputs'] if i['name'] == dname)
        self.lid += 1
        self.r['links'].append([self.lid, src, sslot, dst, self.by[dst]['inputs'].index(i),
                                self.by[src]['outputs'][sslot]['type']])
        o = self.by[src]['outputs'][sslot]
        o['links'] = (o.get('links') or []) + [self.lid]
        i['link'] = self.lid
        self.api[str(dst)]['inputs'][dname] = api_src or [str(src), sslot]

    def headless(self, src, api_src, gate_default, sam3, x0, y0):
        """Clone the Headless graph after the sheet. `gate_default` None = no gate (always runs)."""
        flag = None
        if gate_default is not None:
            flag = self.clone(FLAG, 'Input_Headless', [x0, y0], [gate_default],
                              {'inputs': {'boolean': gate_default}, 'class_type': 'MpiSimpleBoolean', '_meta': {}})
            g = self.clone(INVERTED, 'the sheet, when Headless front body is on', [x0, y0 + 120], [True],
                           {'inputs': {}, 'class_type': 'MpiIfElseInverted', '_meta': {}})
            self.wire(src[0], src[1], g, 'input', api_src)
            self.wire(flag, 0, g, 'boolean')
            src, api_src = (g, 1), None
        size = self.clone(SIZE, 'the sheet size', [x0, y0 + 240], None,
                          {'inputs': {}, 'class_type': 'GetImageSize', '_meta': {}})
        self.wire(src[0], src[1], size, 'image', api_src)
        # Input_Image's slots -> the sheet (image) and the size node (width 0, height 1).
        src_map = {(900, 0): (src, api_src), (900, 2): ((size, 0), None), (900, 3): ((size, 1), None)}
        ids = {}
        for hid, n in sorted(HL.items()):
            if hid == 900 or (hid == 753 and sam3 is not None):
                continue
            title = 'Output_Image_2' if hid == 882 else n.get('title')
            api = copy.deepcopy(HL_API[str(hid)])
            ids[hid] = self.clone(n, title, [x0 + 320 + n['pos'][0] * 0.2, y0 + n['pos'][1] * 0.2],
                                  n.get('widgets_values'), api)
        if sam3 is not None:
            src_map[(753, 0)], src_map[(753, 1)] = ((sam3, 0), None), ((sam3, 1), None)
        for _, s, ss, d, ds, _t in HL_LINKS:
            (sid, sslot), a = src_map.get((s, ss)) or ((ids[s], ss), None)
            self.wire(sid, sslot, ids[d], HL[d]['inputs'][ds]['name'], a)
        # every API link input of a clone must now point inside this graph
        for hid in ids.values():
            for v in self.api[str(hid)]['inputs'].values():
                if isinstance(v, list):
                    assert v[0] in self.api, (self.name, hid, v)
        return flag

    def save(self):
        self.r['last_node_id'], self.r['last_link_id'] = self.nid, self.lid
        nl = '\r\n' if '\r\n' in self.raw else '\n'
        out = json.dumps(self.r, indent=2, ensure_ascii=False).replace('\n', nl)
        open(RAW + self.name, 'wb').write((out + (nl if self.raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
        open(ROOT + self.name, 'wb').write((json.dumps(self.api, indent=2, ensure_ascii=False) + '\n').encode('utf-8'))


# Character Sheet: the sheet (GetNode 'Get_sheet output' in raw) -> headless, always.
cs = Graph('flow_character_sheet.json')
out = next(n for n in cs.r['nodes'] if n.get('title') == 'Output_Image')
link = next(l for l in cs.r['links'] if l[0] == out['inputs'][0]['link'])
cs.headless((link[1], link[2]), cs.api[str(out['id'])]['inputs']['images'], None, None, -3600, 8600)
cs.save()
print(f'character sheet: nodes -> {cs.nid}, links -> {cs.lid}')

# from Images: the sheet (node 59, VRAM freed after Qwen) -> gate on Input_Headless -> headless.
fi = Graph('flow_character_sheet_from_images.json')
assert fi.by[60]['title'] == 'Output_Image' and fi.by[29]['type'] == 'CheckpointLoaderSimple'
link = next(l for l in fi.r['links'] if l[0] == fi.by[60]['inputs'][0]['link'])
fi.headless((link[1], link[2]), None, True, 29, 4200, 1800)
fi.save()
print(f'from images: nodes -> {fi.nid}, links -> {fi.lid}')
