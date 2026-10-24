# Overshoot refs for the weak 3/4 FRONT turn (round 26): the edit undershoots tq_fl (asked 45 deg, lands ~15-20), so
# twins of tq_fl swung further round the doll - tq_fl_65 / tq_fl_80 (degrees from the front, same distance, height
# and aim). Every other camera is removed so ref_render.py renders only the twins (out/doll/<cam>.png - new names,
# the existing refs are untouched). Saves a NEW file; doll_refs.blend is never written.
# Usage: blender-5.2 -b out/doll_refs.blend --python overshoot_build.py   then render out/doll_overshoot.blend
# with ref_render.py.
import math
import os
import bpy

cams = [o for o in bpy.data.objects if o.type == 'CAMERA']
cam = bpy.data.objects['tq_fl']  # (1.84, -1.84, 1.0), z-rot 45: the doll faces -Y, so 0 deg = straight in front
r = math.hypot(cam.location.x, cam.location.y)
for deg in (65, 80):
    twin = cam.copy()
    twin.data = cam.data.copy()
    a = math.radians(deg)
    twin.location = (r * math.sin(a), -r * math.cos(a), cam.location.z)
    twin.rotation_euler = (cam.rotation_euler.x, 0, a)
    twin.name = f'tq_fl_{deg}'
    bpy.context.scene.collection.objects.link(twin)
for c in cams:
    bpy.data.objects.remove(c)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out',
                                                  'doll_overshoot.blend'), copy=True)
