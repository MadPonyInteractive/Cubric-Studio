"""MPI-1271: make Custom size on Control also set the output size (Krea2, Chroma); re-bypass Klein comparers."""
import copy, json, sys
sys.stdout.reconfigure(encoding='utf-8')
RAW = 'comfy_workflows/raw/'

def load(name):
    p = RAW + name
    return p, json.load(open(p, encoding='utf8'))

def save(p, w):
    open(p, 'w', encoding='utf8', newline='\n').write(json.dumps(w, indent=2, ensure_ascii=False))

class G:
    def __init__(s, w): s.w = w; s.N = {n['id']: n for n in w['nodes']}
    def link_of(s, lid): return next(l for l in s.w['links'] if l[0] == lid)
    def unlink(s, tid, inp):
        x = next(i for i in s.N[tid]['inputs'] if i['name'] == inp)
        lid = x.get('link')
        if lid is None: return
        l = s.link_of(lid); o = s.N[l[1]]['outputs'][l[2]]
        o['links'] = [k for k in (o.get('links') or []) if k != lid]
        s.w['links'] = [k for k in s.w['links'] if k[0] != lid]; x['link'] = None
    def connect(s, sid, slot, tid, inp):
        s.unlink(tid, inp)
        x = next(i for i in s.N[tid]['inputs'] if i['name'] == inp)
        o = s.N[sid]['outputs'][slot]
        s.w['last_link_id'] += 1; lid = s.w['last_link_id']
        s.w['links'].append([lid, sid, slot, tid, s.N[tid]['inputs'].index(x), o['type'] if o['type'] != '*' else x['type']])
        o['links'] = (o.get('links') or []) + [lid]; x['link'] = lid
    def clone(s, donor, title, dx=0, dy=0, widgets=None):
        n = copy.deepcopy(s.N[donor]); s.w['last_node_id'] += 1; n['id'] = s.w['last_node_id']
        for i in n.get('inputs', []): i['link'] = None
        for o in n.get('outputs', []): o['links'] = []
        if title is None: n.pop('title', None)
        else: n['title'] = title
        if widgets is not None: n['widgets_values'] = widgets
        n['pos'] = [n['pos'][0] + dx, n['pos'][1] + dy]
        s.w['nodes'].append(n); s.N[n['id']] = n; return n['id']
    def remove(s, nid):
        n = s.N[nid]
        for i in n.get('inputs', []): s.unlink(nid, i['name'])
        for o in n.get('outputs', []):
            for lid in list(o.get('links') or []):
                l = s.link_of(lid); s.unlink(l[3], next(i['name'] for i in s.N[l[3]]['inputs'] if i.get('link') == lid))
        s.N.pop(nid); s.w['nodes'] = [k for k in s.w['nodes'] if k['id'] != nid]

def geom(w): return {n['id']: (n['pos'], n.get('size')) for n in w['nodes']}

# --- Krea2: drop duplicate Input_custom_size 771; control switch 770 reads the existing one
#     via Get_custom size; new 'Custom Size (latent)' on the control latent (any_3).
p, w = load('krea2_t2i_template.json'); g = G(w); before = geom(w)
assert g.N[771]['title'] == 'Input_custom_size' and g.N[747]['title'] == 'Input_custom_size'
g.remove(771)
get_cs = g.clone(749, 'Get_custom size', dx=0, dy=-120)
g.N[get_cs]['pos'] = [g.N[770]['pos'][0] - 260, g.N[770]['pos'][1] + 60]
g.connect(get_cs, 0, 770, 'boolean')
g.N[770]['title'] = 'Custom Size (control)'
lat = g.clone(770, 'Custom Size (latent)', dy=200)
g.connect(560, 0, lat, 'true'); g.connect(515, 0, lat, 'false'); g.connect(get_cs, 0, lat, 'boolean')
g.connect(lat, 0, 561, 'any_3')
after = geom(w); assert all(after[i] == before[i] for i in before if i in after and i != 771), 'geometry moved'
save(p, w); print('krea2 ok: get', get_cs, 'latent switch', lat)

# --- Chroma: new 'Custom Size (latent)' on the depth latent (2758.true): W x H empty latent when on.
p, w = load('chroma_t2i_template.json'); g = G(w); before = geom(w)
g.N[2801]['title'] = 'Custom Size (control)'
lat = g.clone(2801, 'Custom Size (latent)', dy=200)
g.connect(1739, 0, lat, 'true'); g.connect(2762, 0, lat, 'false'); g.connect(2802, 0, lat, 'boolean')
g.connect(lat, 0, 2758, 'true')
after = geom(w); assert all(after[i] == before[i] for i in before), 'geometry moved'
save(p, w); print('chroma ok: latent switch', lat)

# --- Klein: the rgthree Image Comparers go back to bypassed (rgthree is not a shipped node pack).
p, w = load('klein_t2i_template.json'); g = G(w)
for i in (453, 457, 643):
    assert g.N[i]['type'] == 'Image Comparer (rgthree)'; g.N[i]['mode'] = 4
g.N[717]['title'] = 'Custom Size (control)'
save(p, w); print('klein ok')
