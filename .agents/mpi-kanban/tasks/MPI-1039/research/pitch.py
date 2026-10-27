"""Camera pitch from the floor (Fabio 2026-10-27): the LLM cannot judge camera height (heightcheck.py), so measure it.
ComfyUI's native MoGe (v1 vitl, G:/ComfyUi models/geometry_estimation - a hard link to models/MoGe) gives camera-space
normals; floor pixels (bottom rows, facing up) give the world-up vector in camera space, and its tilt toward the
camera is the pitch: + = camera looks DOWN (high), - = looks UP (low), 0 = level.

  python pitch.py test     every picture in heightcheck.PAIRS, then the pairs scored (out/pitch_moge.json)
  python pitch.py <png>    one picture
Free (local GPU), under gpu_lease.py.
"""
import json, math, os, shutil, sys

import numpy as np
from PIL import Image

import split1 as s
from heightcheck import PAIRS

OUT = os.path.join(s.HERE, 'out', 'pitch_moge.json')
BOTTOM = 0.25   # floor = the bottom quarter of the frame...
UP = 0.5        # ...where the surface faces up (the person's sides face sideways and drop out)
LOW, HIGH, SAME = -8.0, 15.0, 8.0  # degrees; first guesses, set from the pairs below


def pitch(path, tag):
    name = f'mpi1039_pitch_{tag}.png'
    shutil.copyfile(path, os.path.join(s.COMFY, 'input', name))
    g = {'1': ('LoadMoGeModel', {'model_name': 'moge_vitl.safetensors'}),
         '2': ('LoadImage', {'image': name}),
         '3': ('MoGeInference', {'moge_model': ['1', 0], 'image': ['2', 0], 'resolution_level': 9, 'fov_x_degrees': 0.0,
                                 'batch_size': 1, 'force_projection': True, 'apply_mask': True, 'refine_steps': 3}),
         '4': ('MoGeRender', {'moge_geometry': ['3', 0], 'output': 'normal_opengl'}),
         '5': ('SaveImage', {'images': ['4', 0], 'filename_prefix': f'mpi1039_pitch/{tag}_normal'})}
    img = s.files(s.submit({k: {'class_type': c, 'inputs': i} for k, (c, i) in g.items()}), 'images')[0]
    n = np.asarray(Image.open(img).convert('RGB'), np.float32) / 127.5 - 1  # OpenGL: x right, y up, z toward camera
    floor = n[int(n.shape[0] * (1 - BOTTOM)):].reshape(-1, 3)
    floor = floor[floor[:, 1] > UP]
    if len(floor) < 500:
        return None, img, len(floor)
    up = np.median(floor, 0)
    return round(math.degrees(math.atan2(up[2], up[1])), 1), img, len(floor)


def label(p):
    return 'low' if p < LOW else 'high' if p > HIGH else 'level'


if __name__ == '__main__':
    if sys.argv[1] != 'test':
        print(pitch(sys.argv[1], 'one'))
        sys.exit()
    res = json.load(open(OUT)) if os.path.exists(OUT) else {}
    pics = {p for _, a, b, _, _ in PAIRS for p in (a, b)}
    for i, p in enumerate(sorted(pics)):
        if p not in res:
            res[p] = dict(zip(('pitch', 'normal', 'floor_px'), pitch(p, f'p{i}')))
            json.dump(res, open(OUT, 'w'), indent=1)
    ok_m = ok_c = 0
    for name, a, b, moved, cam in PAIRS:
        pa, pb = res[a]['pitch'], res[b]['pitch']
        if pa is None or pb is None:
            print(f'{name:20} no floor ({res[a]["floor_px"]}/{res[b]["floor_px"]} px)')
            continue
        d = pb - pa
        m = 'up' if d > SAME else 'down' if d < -SAME else 'same'
        c = label(pb)
        ok_m += m == moved; ok_c += c == cam
        print(f'{name:20} truth {moved:5}/{cam:6} pitch {pa:6.1f} -> {pb:6.1f} (d {d:+6.1f}) read {m:5}/{c:6}'
              f'{"" if m == moved else "   <-- MOVED WRONG"}{"" if c == cam else "  <-- CAM WRONG"}')
    print(f'moved {ok_m}/{len(PAIRS)} cam {ok_c}/{len(PAIRS)}')
