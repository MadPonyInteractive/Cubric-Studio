# Renders the SOFT Cosmo previews (soft_build.py) from the preview cameras, to out/cosmo_soft/<stop>.png. Before each
# frame the key light moves up and to the LEFT of that camera and the fill to its right, so every view is lit alike.
# Stops: all 24 by default, or the ones named after `--` (e.g. -- front tq_br pr_l_hi). Device: CPU unless `gpu` is
# named, so a test render never shares the GPU with a generation.
# Usage: blender-5.2 -b out/cosmo_soft.blend --python soft_render.py -- [gpu] [stop ...]
import os
import sys
import bpy
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__)) + '/out/cosmo_soft'
TURNS = ('front', 'tq_fl', 'tq_fr', 'pr_l', 'pr_r', 'tq_bl', 'tq_br', 'back')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
s = bpy.context.scene
if 'gpu' in args:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type != 'CPU'
    s.cycles.device = 'GPU'
else:
    s.cycles.device = 'CPU'
want = [a for a in args if a != 'gpu']
stops = []
for turn in TURNS:
    for h, cam in (('', f'{turn}_eye' if turn in ('front', 'back') else turn), ('_lo', f'{turn}_lo'), ('_hi', f'{turn}_hi')):
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
    s.render.filepath = f'{OUT}/{stop}.png'
    bpy.ops.render.render(write_still=True)
    print('rendered', s.render.filepath)
