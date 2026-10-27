"""MPI-1306: Character Sheet from Images, a non-human branch.

The describer answers PERSON or OTHER on the boxed face (`Input_Character_Kind`). OTHER (a robot,
a mascot, an animal, an object) swaps the human wording for one with no ear, chin, cheek, hair or
clothes, and drops the clothes caption. Empty (no describer: the Sheet Editor's child rebuild, an
agent's raw call) is the human path, as before.
Patches the raw graph and its runtime twin together; refuses to run twice.
usage: python patch_other.py
"""
import copy, json

ROOT = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
NAME = 'flow_character_sheet_from_images.json'

NO_BODY_OTHER = (
    'Character reference sheet of the character from image 1, in exactly the same visual style and medium as '
    'image 1, with exactly its shapes, colours, parts and proportions. The character is not a person: draw only '
    'the shapes image 1 shows, with no human features, anatomy, hair or clothing that image 1 does not show, and '
    'give it a body in the same shapes and style. [CHARACTER PROMPT]')
WITH_BODY_OTHER = (
    'Character reference sheet of the character from image 1, in exactly the same visual style and medium as '
    'image 1. The head comes only from image 1, with exactly its shape, colours and features. The body comes from '
    'image 2, which shows the character\'s body with its head removed: put the head from image 1 on that body '
    'in every view, the back view included, keeping exactly the body\'s shape, colours, parts and proportions from image 2. The character is not a person: '
    'draw only the shapes the two pictures show, with no human features, anatomy, hair or clothing that they do '
    'not show. [CHARACTER PROMPT]')
LAYOUT_OTHER = (
    'A single continuous image containing three views of the same character arranged side by side in one unbroken '
    'frame, the two full-body views on the left and the close-up on the right, the grey background flowing '
    'continuously behind all three, the same character in every view with identical shapes, colours and details. '
    'The right half of the image is filled by a close-up of the character\'s head and upper body, turned 45 degrees '
    'toward the left side of the image so its front and one side both show, with the same features and expression '
    'as image 1, nothing added that image 1 does not show, sharp and clear, the whole head inside the frame. The '
    'left half holds two narrow full-body standing views of equal width, one seen from the front and one from '
    'directly behind, each showing the whole character from the top of its head to its feet, in a neutral relaxed standing pose with the character\'s own proportions, generous '
    'headroom. Plain smooth grey seamless studio background. Extremely even frontal illumination, soft open '
    'shadows, uniform brightness from edge to edge.')


class Graph:
    def __init__(self):
        self.raw = open(ROOT + 'raw/' + NAME, 'rb').read().decode('utf-8')
        self.r = json.loads(self.raw)
        self.api = json.load(open(ROOT + NAME, encoding='utf-8'))
        self.by = {n['id']: n for n in self.r['nodes']}
        self.nid, self.lid = self.r['last_node_id'], self.r['last_link_id']
        if any(n.get('title') == 'Input_Character_Kind' for n in self.r['nodes']):
            raise SystemExit('already patched')

    def clone(self, src, title, pos, widgets):
        self.nid += 1
        c = copy.deepcopy(self.by[src])
        c.update({'id': self.nid, 'pos': pos, 'order': 100 + self.nid, 'title': title, 'widgets_values': widgets})
        for i in c.get('inputs', []):
            i['link'] = None
        for o in c.get('outputs', []):
            o['links'] = []
        self.r['nodes'].append(c)
        self.by[self.nid] = c
        a = copy.deepcopy(self.api[str(src)])
        a['_meta']['title'] = title
        for k, v in list(a['inputs'].items()):
            if isinstance(v, list):
                del a['inputs'][k]
        self.api[str(self.nid)] = a
        return self.nid

    def set_api(self, nid, key, value):
        self.api[str(nid)]['inputs'][key] = value

    def wire(self, src, sslot, dst, dname):
        i = next(i for i in self.by[dst]['inputs'] if i['name'] == dname)
        if i.get('link') is not None:  # replace an existing link
            old = next(l for l in self.r['links'] if l[0] == i['link'])
            self.r['links'].remove(old)
            so = self.by[old[1]]['outputs'][old[2]]
            so['links'] = [x for x in so['links'] if x != old[0]]
        self.lid += 1
        o = self.by[src]['outputs'][sslot]
        self.r['links'].append([self.lid, src, sslot, dst, self.by[dst]['inputs'].index(i), o['type']])
        o['links'] = (o.get('links') or []) + [self.lid]
        i['link'] = self.lid
        self.api[str(dst)]['inputs'][dname] = [str(src), sslot]

    def save(self):
        self.r['last_node_id'], self.r['last_link_id'] = self.nid, self.lid
        nl = '\r\n' if '\r\n' in self.raw else '\n'
        out = json.dumps(self.r, indent=2, ensure_ascii=False).replace('\n', nl)
        open(ROOT + 'raw/' + NAME, 'wb').write((out + (nl if self.raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
        open(ROOT + NAME, 'wb').write((json.dumps(self.api, indent=2, ensure_ascii=False) + '\n').encode('utf-8'))


g = Graph()
kind = g.clone(12, 'Input_Character_Kind', [-380, -40], [''])
g.set_api(kind, 'string', '')
other = g.clone(13, 'character is not a person?', [-60, -40], ['other'])
g.set_api(other, 'words', 'other')
g.wire(kind, 0, other, 'text')

# The opening: has-body select for OTHER, then person-or-not over both.
nb = g.clone(43, 'Sheet_Prompt_No_Body_Other', [600, -2300], [NO_BODY_OTHER])
g.set_api(nb, 'value', NO_BODY_OTHER)
wb = g.clone(43, 'Sheet_Prompt_With_Body_Other', [600, -2050], [WITH_BODY_OTHER])
g.set_api(wb, 'value', WITH_BODY_OTHER)
sel_o = g.clone(45, 'Sheet_Prompt_Select_Other (has body?)', [1060, -2300], [True])
g.wire(wb, 0, sel_o, 'true')
g.wire(nb, 0, sel_o, 'false')
g.wire(28, 4, sel_o, 'boolean')
opening = g.clone(45, 'Sheet_Prompt_Select (not a person?)', [1220, -1900], [True])
g.wire(sel_o, 0, opening, 'true')
g.wire(45, 0, opening, 'false')
g.wire(other, 0, opening, 'boolean')
g.wire(opening, 0, 49, 'string_a')

# The layout: one wording for OTHER, the turn select for a person.
lo = g.clone(43, 'Sheet_Prompt_Other', [600, -760], [LAYOUT_OTHER])
g.set_api(lo, 'value', LAYOUT_OTHER)
layout = g.clone(48, 'Sheet_Prompt_Select (not a person?) layout', [1220, -1280], [True])
g.wire(lo, 0, layout, 'true')
g.wire(48, 0, layout, 'false')
g.wire(other, 0, layout, 'boolean')
g.wire(layout, 0, 49, 'string_b')

# No clothes caption for OTHER: the describer turned a robot's chest plate into "a pink jumpsuit".
cap = g.clone(25, 'caption only for a person', [540, -540], [True])
g.wire(24, 0, cap, 'true')
g.wire(25, 0, cap, 'false')
g.wire(other, 0, cap, 'boolean')
g.wire(cap, 0, 26, 'string_a')

for nid, n in g.api.items():
    for v in n['inputs'].values():
        if isinstance(v, list):
            assert v[0] in g.api, (nid, v)
g.save()
print('patched; last node', g.nid, 'last link', g.lid)
