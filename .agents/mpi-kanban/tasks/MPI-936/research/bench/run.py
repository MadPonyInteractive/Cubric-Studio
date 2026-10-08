# MPI-936: run graph.py presets on the G: bench and save each result to OUT. Run under the GPU lease with the
# bench python (it has PIL):
#   python gpu_lease.py run -- G:/ComfyUi/python_embeded/python.exe run.py t2i_square t2i_rgba ...
# An edit preset names earlier presets' outputs as its references; they are uploaded to the bench input/mpi936/.
import asyncio, io, json, os, sys, threading, time, urllib.parse, urllib.request
import aiohttp
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import graph as qg  # noqa: E402

URL = 'http://127.0.0.1:8188'
OUT = os.environ.get('MPI936_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
WOMAN = ('Photo of a young woman with short auburn hair in a plain white t-shirt, standing in a sunlit '
         'kitchen, waist-up, looking at the camera, soft window light.')
PRESETS = {
    't2i_square': dict(prompt=WOMAN),
    't2i_wide': dict(prompt='A misty pine forest at dawn, a wooden cabin by a still lake, wide landscape photo.',
                     width=1344, height=768, seed=7),
    't2i_rgba': dict(prompt='A glossy red apple with one green leaf, product shot, transparent background, '
                            'alpha channel.', seed=3),
    't2i_2k': dict(prompt=WOMAN, width=1472, height=1472, seed=9),
    't2i_jacket': dict(prompt='A tan suede jacket with a fleece collar, laid flat on a plain grey floor, '
                              'product photo.', seed=11),
    'edit_one': dict(prompt='change her t-shirt to a black leather jacket', refs=('t2i_square',), seed=5),
    'edit_two': dict(prompt='dress the woman in image 1 in the jacket from image 2', refs=('t2i_square', 't2i_jacket'),
                     seed=5),
    'edit_rgba': dict(prompt='remove the background, keep only the woman, transparent background, alpha channel',
                      refs=('t2i_square',), seed=5),
    # A box mask over the lower half of the frame (her t-shirt): the edit must stay inside it.
    'edit_masked': dict(prompt='change her t-shirt to a black leather jacket', refs=('t2i_square',), seed=5,
                        mask_box=(0.15, 0.55, 0.85, 1.0)),
    # Klein's other ops, by Input_wf_type (graph.py header).
    'i2i': dict(prompt='Watercolour painting of a young woman with short auburn hair in a white t-shirt in a sunlit '
                       'kitchen, soft washes, visible paper texture.', refs=('t2i_square',), wf=2, denoise=0.65, seed=5),
    'i2i_85': dict(prompt='Watercolour painting of a young woman with short auburn hair in a white t-shirt in a sunlit '
                          'kitchen, soft washes, visible paper texture.', refs=('t2i_square',), wf=2, denoise=0.85, seed=5),
    # The kettle on the left counter becomes a plant: a real object swap, prompt describing the whole picture.
    'inpaint': dict(prompt='Photo of a young woman with short auburn hair in a white t-shirt in a sunlit kitchen, a '
                           'small green potted plant on the counter beside her.', refs=('t2i_square',), wf=5, seed=5,
                    mask_box=(0.0, 0.58, 0.2, 0.82)),
    'detail': dict(prompt='Close-up photo of a young woman\'s face, high skin detail, visible pores, sharp eyes.',
                   refs=('t2i_square',), wf=6, denoise=0.35, seed=5, mask_box=(0.3, 0.1, 0.7, 0.5)),
    'upscale': dict(prompt=WOMAN, refs=('t2i_square',), wf=7, denoise=0.3, upscale=1.5, seed=5),
    'upscale_45': dict(prompt=WOMAN, refs=('t2i_square',), wf=7, denoise=0.45, upscale=1.5, seed=5),
    # The Model Library card (comfy_workflows/display/qwen-image-2-1.webp), 896x1088 like klein-9b.webp.
    'preview_a': dict(prompt='Photo of a smiling young woman in a yellow raincoat riding a red vintage bicycle down a '
                             'rainy Lisbon street at golden hour, a yellow tram behind her, warm low sunlight from the '
                             'left glinting on wet cobblestones, vivid colours, shot on a 50mm lens.',
                      width=896, height=1088, seed=21),
    'preview_b': dict(prompt='Photo of a young man with curly hair laughing as he feeds a curious alpaca over a wooden '
                             'fence in a green Andean valley, snowy peaks behind, bright late-afternoon sun from the '
                             'right, vivid colours, shot on a 35mm lens.', width=896, height=1088, seed=22),
    # control: a different subject on her structure. Input_Control_Net 2 depth (the default), 1 pose.
    'control_depth': dict(prompt='A bronze statue of a woman with short hair in a museum hall, dramatic spotlight.',
                          refs=('t2i_square',), wf=3, seed=5),
    'control_pose': dict(prompt='An astronaut in a white spacesuit, helmet off, standing on the surface of Mars.',
                         refs=('t2i_square',), wf=3, seed=5, control=1),
}


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def upload(name):
    """Upload OUT/<name>.png to the bench input/mpi936/ and return the MpiLoadImage string."""
    data = open(os.path.join(OUT, name + '.png'), 'rb').read()
    b = '----mpi936'
    body = (f'--{b}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\nmpi936\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{name}.png"\r\n'
            f'Content-Type: image/png\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request(URL + '/upload/image', data=body,
                                 headers={'Content-Type': f'multipart/form-data; boundary={b}'})
    urllib.request.urlopen(req, timeout=60).read()
    return f'mpi936/{name}.png'


# progressStages.js needs the number of times the status bar restarts per run, and the app's bar is fed by
# these same websocket `progress` messages - so count restarts here rather than reading a terminal.
EVENTS = []


async def _listen():
    async with aiohttp.ClientSession() as s, s.ws_connect('ws://127.0.0.1:8188/ws?clientId=mpi936') as ws:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                m = json.loads(msg.data)
                if m.get('type') == 'progress':
                    d = m['data']
                    EVENTS.append((d.get('prompt_id'), d.get('node'), d['value'], d['max']))


threading.Thread(target=lambda: asyncio.run(_listen()), daemon=True).start()
time.sleep(1)


def bars(pid):
    n, last = 0, None
    for p, node, v, mx in EVENTS:
        if p != pid:
            continue
        if last is None or v <= last[0] or node != last[1]:
            n += 1
        last = (v, node)
    return n


os.makedirs(OUT, exist_ok=True)
for name in sys.argv[1:]:
    p = dict(PRESETS[name])
    box = p.pop('mask_box', None)
    if box:
        w, h = Image.open(os.path.join(OUT, p['refs'][0] + '.png')).size
        m = Image.new('RGB', (w, h))
        m.paste((255, 255, 255), (int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
        m.save(os.path.join(OUT, name + '_mask.png'))
        p['mask'] = upload(name + '_mask')
    p['refs'] = tuple(upload(r) for r in p.get('refs', ()))
    t0 = time.time()
    try:
        pid = call('/prompt', {'prompt': qg.graph(**p), 'client_id': 'mpi936'})['prompt_id']
    except urllib.error.HTTPError as e:
        print(name, 'REJECTED', e.read().decode()[:4000], flush=True)
        sys.exit(1)
    while True:
        time.sleep(3)
        h = call(f'/history/{pid}')
        if pid in h:
            break
    st = h[pid].get('status', {})
    if st.get('status_str') != 'success':
        print(name, 'FAILED', json.dumps(st.get('messages', []))[-4000:], flush=True)
        sys.exit(1)
    # Output_Image (node 35) only: an MpiLoadImage previews its loaded reference as an `images` output too.
    f = h[pid]['outputs']['35']['images'][0]
    q = urllib.parse.urlencode({'filename': f['filename'], 'subfolder': f['subfolder'], 'type': f['type']})
    raw = urllib.request.urlopen(f'{URL}/view?{q}', timeout=60).read()
    im = Image.open(io.BytesIO(raw))
    alpha = ''
    if im.mode == 'RGBA':
        a = im.getchannel('A')
        lo, hi = a.getextrema()
        clear = sum(1 for v in a.getdata() if v < 16) / (im.width * im.height)
        alpha = f' alpha {lo}-{hi}, {clear:.0%} transparent'
    open(os.path.join(OUT, name + '.png'), 'wb').write(raw)
    print(f'{name}: {time.time() - t0:.0f}s {im.width}x{im.height} {im.mode}{alpha}, {bars(pid)} progress bar(s)',
          flush=True)
print('ALL DONE', flush=True)
