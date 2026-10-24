# Zoom refs on the MANNEQUIN (round 19, people zoom): obj_build.py's cube-branch lens twins (<cam>_near x1.8 /
# <cam>_far x0.55, same position) for front_hi and tq_fl, on Fabio's posed file. Every other camera is removed so
# ref_render.py renders only the four twins (out/<cam>.png - new names, the existing refs are untouched). Saves a NEW
# file; the posed file is never written.
# Usage: blender-5.2 -b out/UE4_Mannequinn_refs.blend --python zoom_build.py   then render out/mannequin_zoom.blend
# with ref_render.py.
import os
import bpy

cams = [o for o in bpy.data.objects if o.type == 'CAMERA']
for name in ('front_hi', 'tq_fl'):
    cam = bpy.data.objects[name]
    for tag, k in (('near', 1.8), ('far', 0.55)):
        twin = cam.copy()
        twin.data = cam.data.copy()
        twin.data.lens = cam.data.lens * k
        twin.name = f'{name}_{tag}'
        bpy.context.scene.collection.objects.link(twin)
for cam in cams:
    bpy.data.objects.remove(cam)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out',
                                                  'mannequin_zoom.blend'), copy=True)
