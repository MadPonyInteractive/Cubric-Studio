# Renders every camera of the opened ref scene (built by ref_build.py, posed by Fabio) to out/<camera>.png.
# `-- outline` renders a LINE-DRAWING variant to out/outline/: the body takes the wall's grey and only its outline and
# ridges show, so the edit has less grey body to copy (round 5: low views leaked the mannequin's body).
# Usage: blender-5.2 -b out/UE4_Mannequinn_refs.blend --python ref_render.py [-- outline]      Never saves.
import os
import sys
import bpy

s = bpy.context.scene
s.render.use_compositing = False
s.render.image_settings.file_format = 'PNG'
out = os.path.dirname(os.path.abspath(__file__)) + '/out'
if 'outline' in sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else False:
    out += '/outline'
    sh = s.display.shading
    sh.light = 'FLAT'  # no shading: the body is the wall's tone, so only the lines read
    sh.show_object_outline = True
    sh.object_outline_color = (0.85, 0.85, 0.85)
    sh.show_cavity = True
    sh.cavity_type = 'WORLD'
    sh.cavity_ridge_factor, sh.cavity_valley_factor = 2.0, 2.0
    bpy.data.objects['SK_MannequinMesh'].color = (0.16, 0.16, 0.16, 1)
for cam in [o for o in s.objects if o.type == 'CAMERA']:
    s.camera = cam
    s.render.filepath = os.path.join(out, cam.name + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', s.render.filepath)
