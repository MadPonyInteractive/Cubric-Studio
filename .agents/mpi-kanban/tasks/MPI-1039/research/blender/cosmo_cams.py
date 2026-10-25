# Flow build phase 1 (2026-10-25): the gizmo's Cosmo previews for EVERY stop of the approved grid (8 turns x level /
# low / high), from the SAME cameras as the model refs. cosmo.blend only has the base cameras; the profile and turned
# low/high twins exist only in doll_plain.blend (plain_build.py), so its cameras replace cosmo's. The level FRONT stop
# has no ref camera (the source is the front), so front_eye = back_eye turned round. Renders every stop to
# out/cosmo/<stop>.png and saves out/cosmo_previews.blend - cosmo.blend is never written.
# Usage: "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b out/cosmo.blend --python cosmo_cams.py
import math
import os
import bpy

OUT = os.path.dirname(os.path.abspath(__file__)) + '/out'
TURNS = ('front', 'tq_fl', 'tq_fr', 'pr_l', 'pr_r', 'tq_bl', 'tq_br', 'back')
s = bpy.context.scene
for cam in [o for o in s.objects if o.type == 'CAMERA']:
    bpy.data.objects.remove(cam)
with bpy.data.libraries.load(OUT + '/doll_plain.blend') as (src, dst):
    dst.objects = [n for n in src.objects]
for o in dst.objects:
    if o is not None and o.type == 'CAMERA':
        s.collection.objects.link(o)
back = s.objects['back_eye']
front = back.copy()
front.data = back.data.copy()
front.location = (-back.location.x, -back.location.y, back.location.z)
front.rotation_euler = (back.rotation_euler.x, 0, back.rotation_euler.z + math.pi)
front.name = 'front_eye'
s.collection.objects.link(front)
s.render.use_compositing = False
s.render.image_settings.file_format = 'PNG'
for turn in TURNS:
    for h, cam in (('', f'{turn}_eye' if turn in ('front', 'back') else turn), ('_lo', f'{turn}_lo'), ('_hi', f'{turn}_hi')):
        s.camera = s.objects[cam]
        s.render.filepath = f'{OUT}/cosmo/{turn}{h}.png'
        bpy.ops.render.render(write_still=True)
        print('rendered', s.render.filepath)
bpy.ops.wm.save_as_mainfile(filepath=OUT + '/cosmo_previews.blend', copy=True)
