# Renders the SOFT Cosmo previews (soft_build.py, or scifi_build.py's server room) from the preview cameras, to
# out/<blend name>/<stop>.png (out/cosmo_soft/ or out/cosmo_scifi/). Before each frame the key light moves up and to
# the LEFT of that camera and the fill to its right, so every view is lit alike.
# Stops: all 24 + the 8 '<turn>_far' + the 16 '<turn>_lo_far' / '<turn>_hi_far' (round 51) by default, or the ones named after `--` (e.g. -- front tq_br pr_l_hi front_far).
# A _far stop is the turn's eye-level camera with a wider lens (Fabio 2026-10-25: Far away = its own wide render, not
# a crop), so Cosmo stands smaller in more of the room; _lo_far / _hi_far widen the low / high camera the same way. EEVEE renders on the GPU, so run it under gpu_lease.py.
# Usage: gpu_lease.py run -- blender-5.2 -b out/cosmo_soft.blend --python soft_render.py -- [stop ...]
import os
import sys
import bpy
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__)) + '/out/' + os.path.splitext(os.path.basename(bpy.data.filepath))[0]
TURNS = ('front', 'tq_fl', 'tq_fr', 'pr_l', 'pr_r', 'tq_bl', 'tq_br', 'back')
FAR_LENS = 0.5  # x the eye-level lens
s = bpy.context.scene
want = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
stops = []
for turn in TURNS:
    eye = f'{turn}_eye' if turn in ('front', 'back') else turn
    for h, cam in (('', eye), ('_lo', f'{turn}_lo'), ('_hi', f'{turn}_hi'), ('_far', eye),
                   ('_lo_far', f'{turn}_lo'), ('_hi_far', f'{turn}_hi')):
        if not want or turn + h in want:
            stops.append((turn + h, cam))
key, fill = s.objects['soft_key'], s.objects['soft_fill']
os.makedirs(OUT, exist_ok=True)
for stop, cam_name in stops:
    cam = s.objects[cam_name]
    s.camera = cam
    m = cam.matrix_world
    # Camera space: x right, y up, z back toward the viewer. Key up-left-forward of the lens, fill low right.
    key.location = m @ Vector((-3.0, 2.5, -1.0))
    fill.location = m @ Vector((3.0, 0.3, -0.5))
    lens = cam.data.lens
    if stop.endswith('_far'):
        cam.data.lens = lens * FAR_LENS
    s.render.filepath = f'{OUT}/{stop}.png'
    bpy.ops.render.render(write_still=True)
    cam.data.lens = lens
    print('rendered', s.render.filepath)
