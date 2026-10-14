"""MPI-1086 r26, Fabio 2026-10-14: ONE MpiClearVram per edit graph, at the very end of the run - after SAM3 when
Headless front body is on, after the edit when it is off. Every other MpiClearVram is bypassed and removed (Klein 60
+ 120, Qwen 115 + 156 + 184): the node is an OUTPUT_NODE, so ComfyUI runs it whatever it feeds, and mid-graph it only
dragged branches in (156 pulled the Klein mannequin into every Qwen run).
The end node reads a lazy MpiIfElse on Input_Headless: true = the head removal's composite, false = the edit, so it
depends on the run's LAST picture and runs last. Idempotent: refuses to run twice. Convert each file alone after.
"""
import copy, json

RAW = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/'


def patch(name, headless_flag):
    path = RAW + name
    raw = open(path, 'rb').read().decode('utf-8')
    r = json.loads(raw)
    by = {n['id']: n for n in r['nodes']}
    if any(n.get('title') == "free VRAM: the run's last step" for n in r['nodes']):
        raise SystemExit(f'{name}: already patched')
    links = {l[0]: l for l in r['links']}
    clears = [n for n in r['nodes'] if n['type'] == 'MpiClearVram']
    proto = copy.deepcopy(clears[0])
    ends = {}
    for c in clears:
        src = links[c['inputs'][0]['link']]
        by[src[1]]['outputs'][src[2]]['links'].remove(src[0])
        del links[src[0]]
        for lid in c['outputs'][0].get('links') or []:
            l = links[lid]
            l[1], l[2] = src[1], src[2]
            by[src[1]]['outputs'][src[2]]['links'].append(lid)
        ends[c['id']] = (src[1], src[2])
        r['nodes'].remove(c)
        del by[c['id']]
    r['links'] = list(links.values())
    nid, lid = r['last_node_id'], r['last_link_id']

    def add(n, title, pos, widgets):
        nonlocal nid
        nid += 1
        c = copy.deepcopy(n)
        c.update({'id': nid, 'pos': pos, 'order': 100 + nid, 'mode': 0, 'title': title, 'widgets_values': widgets})
        for i in c['inputs']:
            i['link'] = None
        for o in c['outputs']:
            o['links'] = []
        c.pop('widgets_values_named', None)
        r['nodes'].append(c)
        by[nid] = c
        return nid

    def wire(src, sslot, dst, dname):
        nonlocal lid
        lid += 1
        i = next(i for i in by[dst]['inputs'] if i['name'] == dname)
        r['links'].append([lid, src, sslot, dst, by[dst]['inputs'].index(i), by[src]['outputs'][sslot]['type']])
        by[src]['outputs'][sslot]['links'] = (by[src]['outputs'][sslot].get('links') or []) + [lid]
        i['link'] = lid

    ifelse = next(n for n in r['nodes'] if n['type'] == 'MpiIfElse')
    flag = next(n['id'] for n in r['nodes'] if n.get('title') == 'Input_Headless')
    out3 = next(n['id'] for n in r['nodes'] if n.get('title') == 'Output_Image_3')
    edit_out = next(n['id'] for n in r['nodes'] if n.get('title') in ('Output_Image_2',) or
                    (n.get('title') == 'Output_Image' and 'Output_Image_2' not in {m.get('title') for m in r['nodes']}))
    last = add(ifelse, "the run's last picture: the head removal when on, else the edit", [6000, 1800], [True])
    head = links[next(i for i in by[out3]['inputs'] if i['name'] == 'images')['link']]
    edit = links[next(i for i in by[edit_out]['inputs'] if i['name'] == 'images')['link']]
    wire(head[1], head[2], last, 'true')
    wire(edit[1], edit[2], last, 'false')
    wire(flag, 0, last, 'boolean')
    end = add(proto, "free VRAM: the run's last step", [6320, 1800], proto.get('widgets_values'))
    wire(last, 0, end, 'passthrough')
    r['last_node_id'], r['last_link_id'] = nid, lid
    nl = '\r\n' if '\r\n' in raw else '\n'
    out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
    open(path, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
    print(f'{name}: removed {sorted(ends)}, end clear {end} <- if/else {last} (true {head[1]}, false {edit[1]})')


patch('flow_character_sheet_edit.json', 'Input_Headless')
patch('flow_character_sheet_edit_qwen.json', 'Input_Headless')
