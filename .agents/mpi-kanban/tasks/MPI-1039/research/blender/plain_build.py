# Round 30 refs. (1) LOW twins of the turned cameras - tq_fl_lo / tq_br_lo: front_lo's height, distance and 25-deg
# upward tilt (0.15 m up, 1.8 m out) at tq_fl's / tq_br's angle round the doll - for a Qwen low edit on a FLUX.3 turn.
# (2) `-- plain`: Qwen-Image 2.1 pasted the ref's grey room into the place (round 29), so the floor and walls are hidden
# and the doll renders on transparency -> every camera to out/doll_plain/, then flattened onto white (below). Without `plain` every other camera is
# removed, so ref_render.py renders only the twins into out/doll/ (the existing refs are untouched).
# Saves a NEW file (doll_lo.blend / doll_plain.blend); doll_refs.blend is never written.
# Usage: blender-5.2 -b out/doll_refs.blend --python plain_build.py [-- plain]   then render the saved file with
# ref_render.py; for `plain`, flatten: python -c "from PIL import Image; import glob; [Image.alpha_composite(
# Image.new('RGBA', (i := Image.open(p)).size, 'white'), i.convert('RGBA')).convert('RGB').save(p) for p in
# glob.glob('out/doll_plain/*.png')]"
import math
import os
import sys
import bpy

plain = 'plain' in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
s = bpy.context.scene
cams = [o for o in s.objects if o.type == 'CAMERA']
lo = bpy.data.objects['front_lo']
for name in ('tq_fl', 'tq_br'):
    cam = bpy.data.objects[name]
    a = cam.rotation_euler.z  # the doll faces -Y: 0 = straight in front, 45 = front-left, -135 = back-right
    twin = lo.copy()
    twin.data = lo.data.copy()
    twin.location = (1.8 * math.sin(a), -1.8 * math.cos(a), lo.location.z)
    twin.rotation_euler = (lo.rotation_euler.x, 0, a)
    twin.name = f'{name}_lo'
    s.collection.objects.link(twin)
if plain:
    for name in ('floor', 'wall', 'wall_front'):
        bpy.data.objects[name].hide_render = True
    s.render.film_transparent = True  # Workbench ignores world.color (renders flat dark grey); flattened onto white after
    s['refdir'] = 'doll_plain'
else:
    for c in cams:
        bpy.data.objects.remove(c)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out',
                                                  'doll_plain.blend' if plain else 'doll_lo.blend'), copy=True)
