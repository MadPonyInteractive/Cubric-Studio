# Steeper head-and-shoulders refs (round 10): round 7's face_front_lo/hi (~30 degrees) read as eye level on every
# edit. Opens Fabio's posed file, drops every camera, adds face_xlo (~40 deg below the eyes) and face_xhi (~45 deg
# above), and saves a NEW file out/face_refs.blend - the posed file is never written. Render it with ref_render.py.
import os
import bpy
from mathutils import Vector

for cam in [o for o in bpy.data.objects if o.type == 'CAMERA']:
    bpy.data.objects.remove(cam)
EYES = Vector((0, 0, 1.62))
for name, loc in (('face_xlo', (0, -0.55, 1.15)), ('face_xhi', (0, -0.55, 2.2))):
    data = bpy.data.cameras.new(name)
    data.lens = 40
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (EYES - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=os.path.dirname(os.path.abspath(__file__)) + '/out/face_refs.blend')
