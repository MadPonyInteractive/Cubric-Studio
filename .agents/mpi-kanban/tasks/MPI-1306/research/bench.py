"""MPI-1306 bench on the app engine (48188): the PERSON/OTHER describer answer, then sheets.
usage: python bench.py describe | python bench.py sheets"""
import copy, json, sys, time, urllib.request, urllib.parse, uuid, os

E = 'http://127.0.0.1:48188'
REPO = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
SP = os.path.dirname(os.path.abspath(__file__))
M = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Storyboard project/Media/'
GI = 'G:/ComfyUi/ComfyUI/input/'
STAGE = 'C:/AI/Mpi/Cubric-Vision/engine/ComfyUI_windows_portable/ComfyUI/input/mpi1306/'


def stage(path):
    """MpiLoadImage reads only inside the engine's input/: copy there, return the relative name."""
    import shutil
    if not path:
        return ''
    os.makedirs(STAGE, exist_ok=True)
    shutil.copyfile(path, STAGE + os.path.basename(path))
    return 'mpi1306/' + os.path.basename(path)
KIND_Q = ('Is this character a human or human-like person (a man, a woman, a child, an elf, an anime or cartoon '
          'person), or something else (a robot, an animal, a creature, a mascot, an object)? Reply with one word: '
          'PERSON or OTHER.')


def post(graph):
    body = json.dumps({'prompt': graph, 'client_id': str(uuid.uuid4())}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request(E + '/prompt', body, {'Content-Type': 'application/json'})))
    pid = r['prompt_id']
    while True:
        h = json.load(urllib.request.urlopen(f'{E}/history/{pid}'))
        if pid in h:
            st = h[pid]['status']
            if st.get('status_str') != 'success':
                raise SystemExit(f'failed: {json.dumps(st)[:800]}')
            return h[pid]['outputs']
        time.sleep(1)


def text_of(outputs, node):
    o = outputs[node]
    v = o.get('text') or o.get('string') or o
    return v[0] if isinstance(v, list) else str(v)


def by_title(g, t):
    return next(k for k, n in g.items() if n.get('_meta', {}).get('title') == t)


def describe(path):
    g = json.load(open(REPO + 'image_descriptor.json', encoding='utf-8'))
    g[by_title(g, 'Input_Image')]['inputs']['string'] = stage(path)
    g[by_title(g, 'Input_Describe_Prompt')]['inputs']['value'] = (
        f'<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>{KIND_Q}<|im_end|>\n<|im_start|>assistant\n')
    return text_of(post(g), by_title(g, 'Output_prompt')).strip()


def sheet(name, face, body, box, seed, kind, pose, clothes, positive):
    g = json.load(open(REPO + 'flow_character_sheet_from_images.json', encoding='utf-8'))
    s = lambda t, k, v: g[by_title(g, t)]['inputs'].__setitem__(k, v)
    s('Input_Image', 'string', stage(face))
    s('Input_Image_2', 'string', stage(body))
    for k, v in zip(('x', 'y', 'width', 'height'), box):
        s('Input_Box', k, v)
    s('Input_Seed', 'int', seed)
    s('Input_Character_Kind', 'string', kind)
    s('Input_Face_Pose', 'string', pose)
    s('Input_Body_Clothes', 'string', clothes)
    s('Input_Positive', 'string', positive)
    s('Input_Headless', 'boolean', False)
    t0 = time.time()
    out = post(g)
    img = out[by_title(g, 'Output_Image')]['images'][0]
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
    dst = f'{SP}/sheet_{name}.png'
    open(dst, 'wb').write(urllib.request.urlopen(f'{E}/view?{q}').read())
    prompt = text_of(out, by_title(g, 'Output_prompt'))
    open(f'{SP}/sheet_{name}.txt', 'w', encoding='utf-8').write(prompt)
    print(name, f'{time.time() - t0:.0f}s', dst, flush=True)
    return prompt


if sys.argv[1] == 'describe':
    pics = [M + f'imported_00{i}.png' for i in range(1, 6)] + [M + 'resize_6232d917.png'] + [
        GI + p for p in ('mpi1042_front_4x5.png', 'mpi1042_phone_4x5.png', 'mpi1042_smoker_4x5.png',
                         'mpi1042_threequarter_4x5.png', 'mpi1042art_anime.png')]
    for p in pics:
        for rep in range(2):  # sampled at temperature 0.2: ask twice
            print(os.path.basename(p), rep, '->', describe(p), flush=True)
else:
    FABIO = 'Boxy 2D cartoon, Keep the exact same dimensions and proportions.'
    CLOTHES = 'a pink jumpsuit with a white emblem on the chest'
    robot = (M + 'imported_002.png', M + 'resize_6232d917.png', (0, -250, 2000, 2500))
    tag = sys.argv[2] if len(sys.argv) > 2 else ''
    sheet('robot_other_s2342' + tag, *robot, 2342348518, 'OTHER', 'FRONT', CLOTHES, FABIO)
    sheet('robot_other_s42' + tag, *robot, 42, 'OTHER', 'FRONT', CLOTHES, FABIO)
    if tag:
        sheet('robot_other_s7' + tag, *robot, 7, 'OTHER', 'FRONT', CLOTHES, FABIO)
        sheet('cam_other_s42' + tag, M + 'imported_004.png', None, (0, -250, 2000, 2500), 42, 'OTHER', 'FRONT', '', '')
        raise SystemExit
    sheet('robot_person_s2342', *robot, 2342348518, '', 'FRONT', CLOTHES, FABIO)
    p = sheet('human_person_s42', GI + 'mpi1042_front_4x5.png', None, (0, 0, 0, 0), 42, 'PERSON', 'FRONT', '', '')
    print('human prompt mentions ear:', 'near ear fully visible' in p, '| not-a-person words:', 'not a person' in p)
