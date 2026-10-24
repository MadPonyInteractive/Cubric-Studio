# Renders every camera of the opened ref scene (built by ref_build.py, posed by Fabio) to out/<camera>.png.
# `-- outline` renders a LINE-DRAWING variant to out/outline/: the body takes the wall's grey and only its outline and
# ridges show, so the edit has less grey body to copy (round 5: low views leaked the mannequin's body).
# `-- outline nodisc` on a stand-in file hides its front disc (only the panel marks the front) -> out/<dir>/outline_nodisc/.
# Usage: blender-5.2 -b out/UE4_Mannequinn_refs.blend --python ref_render.py [-- outline [nodisc]]      Never saves.
import os
import sys
import bpy

s = bpy.context.scene
s.render.use_compositing = False
s.render.image_settings.file_format = 'PNG'
out = os.path.dirname(os.path.abspath(__file__)) + '/out'
if 'StandIn' in bpy.data.objects:  # <shape>_refs.blend (obj_build.py): the stand-in renders to out/<refdir>/
    out += '/' + bpy.data.objects['StandIn'].get('refdir', 'object')
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
    for o in [o for o in s.objects if o.name.startswith('StandIn')]:  # its front panel + disc stay as outlines
        o.color = (0.16, 0.16, 0.16, 1)
    if 'nodisc' in sys.argv and 'StandIn_disc' in s.objects:  # round 11 painted the disc onto the object's side
        s.objects['StandIn_disc'].hide_render = True
        out += '_nodisc'
for cam in [o for o in s.objects if o.type == 'CAMERA']:
    s.camera = cam
    s.render.filepath = os.path.join(out, cam.name + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', s.render.filepath)
