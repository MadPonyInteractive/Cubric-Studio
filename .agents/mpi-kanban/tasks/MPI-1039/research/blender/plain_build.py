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
# Round 31: low twins for all four turned cameras, and HIGH twins (front_hi's 2.6 m up, 1.6 m out, 47-deg down tilt)
# for tq_fl / tq_br - for a FLUX.3 high edit on a FLUX.3 turn.
for src, out, names in (('front_lo', 'lo', ('tq_fl', 'tq_br', 'tq_fr', 'tq_bl')), ('front_hi', 'hi', ('tq_fl', 'tq_br'))):
    base = bpy.data.objects[src]
    d = -base.location.y
    for name in names:
        a = bpy.data.objects[name].rotation_euler.z  # the doll faces -Y: 0 = in front, 45 = front-left, -135 = back-right
        twin = base.copy()
        twin.data = base.data.copy()
        twin.location = (d * math.sin(a), -d * math.cos(a), base.location.z)
        twin.rotation_euler = (base.rotation_euler.x, 0, a)
        twin.name = f'{name}_{out}'
        s.collection.objects.link(twin)
# Round 35: the profile stops (eye-level pr_l / pr_r = tq_fl's height and distance at +-90 deg), their low and high
# twins, and the high twins still missing (back, tq_fr, tq_bl).
eye = bpy.data.objects['tq_fl']
for name, deg in (('pr_l', 90), ('pr_r', -90)):
    a = math.radians(deg)
    d = math.hypot(eye.location.x, eye.location.y)
    twin = eye.copy()
    twin.data = eye.data.copy()
    twin.location = (d * math.sin(a), -d * math.cos(a), eye.location.z)
    twin.rotation_euler = (eye.rotation_euler.x, 0, a)
    twin.name = name
    s.collection.objects.link(twin)
for src, out, names in (('front_lo', 'lo', ('pr_l', 'pr_r')),
                        ('front_hi', 'hi', ('pr_l', 'pr_r', 'back_eye', 'tq_fr', 'tq_bl'))):
    base = bpy.data.objects[src]
    d = -base.location.y
    for name in names:
        a = bpy.data.objects[name].rotation_euler.z
        twin = base.copy()
        twin.data = base.data.copy()
        twin.location = (d * math.sin(a), -d * math.cos(a), base.location.z)
        twin.rotation_euler = (base.rotation_euler.x, 0, a)
        twin.name = f'{name.replace("_eye", "")}_{out}'
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
