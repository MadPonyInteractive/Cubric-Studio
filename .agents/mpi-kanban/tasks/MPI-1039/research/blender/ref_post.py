# Runs the CLI's generated _render_script.py minus its render call, appends Fabio's rigged UE4 mannequin
# (its default pose is already an A-pose, facing -Y), sets flat grey shadowless Workbench, then renders.
# Usage: blender -b --python ref_post.py -- <_render_script.py>      Never writes the source .blend.
import os
import sys
import bpy

SRC = r'D:\Blender\Other\UE4_Mannequinn.blend'
script = open(sys.argv[sys.argv.index('--') + 1], encoding='utf-8').read()
exec(script.replace('bpy.ops.render.render(write_still=True)', ''))

with bpy.data.libraries.load(SRC, link=False) as (src, dst):
    dst.objects = ['HeroTPP_Character', 'SK_MannequinMesh']
for o in dst.objects:
    bpy.context.scene.collection.objects.link(o)
    o.hide_render = False
dst.objects[0].scale = (0.01, 0.01, 0.01)  # rig is in cm; mesh is parented to it

s = bpy.context.scene
sh = s.display.shading
sh.light = 'STUDIO'  # FLAT made a silhouette: front and back read the same
sh.color_type = 'OBJECT'
sh.background_type = 'VIEWPORT'
sh.background_color = (0.05, 0.05, 0.05)
sh.show_shadows = False
sh.show_cavity = False
sh.show_object_outline = False
bpy.data.objects['floor'].color = (0.06, 0.06, 0.06, 1)
bpy.data.objects['wall'].color = bpy.data.objects['wall_front'].color = (0.16, 0.16, 0.16, 1)
for o in dst.objects:
    o.color = (0.6, 0.6, 0.6, 1)
out = os.path.dirname(s.render.filepath)
for cam in [o for o in s.objects if o.type == 'CAMERA']:
    s.camera = cam
    s.render.filepath = os.path.join(out, cam.name + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', s.render.filepath)
