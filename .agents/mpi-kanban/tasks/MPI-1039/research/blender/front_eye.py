# Round 52: the eye-level FRONT doll the Flow never shipped (it assumed every input already faces front). back_eye
# turned round to -Y, the doll's front. Renders out/doll/front.png only. Never saves.
# Usage: blender-5.2 -b out/doll_refs.blend --python front_eye.py
import os
import bpy

s = bpy.context.scene
s.render.use_compositing = False
s.render.image_settings.file_format = 'PNG'
b = s.objects['back_eye']
cam = bpy.data.objects.new('front', b.data)
s.collection.objects.link(cam)
cam.location = (-b.location.x, -b.location.y, b.location.z)
cam.rotation_euler = (b.rotation_euler.x, 0.0, 0.0)
s.camera = cam
s.render.filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', s['refdir'], 'front.png')
bpy.ops.render.render(write_still=True)
print('rendered', s.render.filepath)
