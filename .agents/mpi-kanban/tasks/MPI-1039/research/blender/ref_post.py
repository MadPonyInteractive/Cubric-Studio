# Runs the CLI's generated _render_script.py minus its render call, appends Fabio's rigged UE4 mannequin
# (facing -Y), poses it standing naturally, sets flat grey shadowless Workbench, then renders.
# Usage: blender -b --python ref_post.py -- <_render_script.py>      Never writes the source .blend.
import math
import os
import sys
import bpy
import mathutils

SRC = r'D:\Blender\Other\UE4_Mannequinn.blend'
script = open(sys.argv[sys.argv.index('--') + 1], encoding='utf-8').read()
exec(script.replace('bpy.ops.render.render(write_still=True)', ''))

with bpy.data.libraries.load(SRC, link=False) as (src, dst):
    dst.objects = ['HeroTPP_Character', 'SK_MannequinMesh']
for o in dst.objects:
    bpy.context.scene.collection.objects.link(o)
    o.hide_render = False
rig = dst.objects[0]
rig.scale = (0.01, 0.01, 0.01)  # rig is in cm; mesh is parented to it

# Natural standing pose (Fabio 2026-10-23: the A-pose leaked into the edits). The rest pose is the A-pose; its
# "T-Pose" action keys every CS_ control and would undo any edit, so drop it. Legs are IK (CS_calf ->
# CS_ik_foot): move the foot controls in, armature space (cm). Arms go FK: moving the IK hand targets made the
# solver roll the upper arms (palms forward) and twist the shoulder caps away, so swing each CS_upperarm down
# about the front-to-back axis through its shoulder - no roll - and the forearm and hand follow.
rig.animation_data.action = None
rig['IK Arm L'] = rig['Ik Arm R'] = 0
rig['Ik Hand L Lock'] = rig['Ik hand R Lock'] = 0
for bone, delta in {'CS_FootMainIK_L': (-10, 0, 0), 'CS_FootMainIK_R': (10, 0, 0)}.items():  # feet ~+-7 cm
    pb = rig.pose.bones[bone]
    m = pb.matrix.copy()
    m.translation += mathutils.Vector(delta)
    pb.matrix = m
    bpy.context.view_layer.update()
# Target = Fabio's shop-mannequin photo (2026-10-24): arms near straight, hands beside the thighs. The A-pose upper
# arm hangs ~50 deg below horizontal (relaxed ~78), the forearm flares ~25 deg out (Y swing) and bends ~25 deg
# forward at the elbow (X swing straightens it to ~8). The clavicles drop 12 so the shoulders slope (Fabio: they sat
# square and high); the upper arm swing gives those 12 back so the hands stay beside the thighs.
for bone, deg, axis in (('CS_clavicle_l', 12, 'Y'), ('CS_clavicle_r', -12, 'Y'),
                        ('CS_upperarm_l', 16, 'Y'), ('CS_upperarm_r', -16, 'Y'), ('CS_lowerarm_l', 20, 'Y'),
                        ('CS_lowerarm_r', -20, 'Y'), ('CS_lowerarm_l', 17, 'X'), ('CS_lowerarm_r', 17, 'X')):
    pb = rig.pose.bones[bone]
    h = pb.head.copy()
    swing = mathutils.Matrix.Rotation(math.radians(deg), 4, axis)
    pb.matrix = mathutils.Matrix.Translation(h) @ swing @ mathutils.Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()
    print(bone, 'tail', tuple(round(x, 1) for x in pb.tail), 'hand', tuple(round(x, 1) for x in rig.pose.bones['hand' + bone[-2:]].head))

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
# The posed scene as a file of its own, for Fabio to adjust by hand in Blender (the source .blend is never written).
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'ref_scene.blend'), copy=True)
for cam in [o for o in s.objects if o.type == 'CAMERA']:
    s.camera = cam
    s.render.filepath = os.path.join(out, cam.name + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', s.render.filepath)
