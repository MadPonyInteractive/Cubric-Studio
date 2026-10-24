# Builds the ref scene INSIDE a copy of Fabio's posed UE4 file (he poses there by hand; the copy is the source of
# truth from then on): the CLI's floor, walls, cameras and render settings, his left arm mirrored to the right, the
# feet in, flat grey Workbench. Saves the copy in place; ref_render.py renders it.
# Usage: blender-5.2 -b <copy.blend> --python ref_build.py -- <_render_script.py>      Never touches his original.
import math  # the CLI script's own imports are cut off with its delete step
import sys
import bpy
import mathutils

script = open(sys.argv[sys.argv.index('--') + 1], encoding='utf-8').read()
# The CLI script opens by deleting every object - his rig included - so run it from its scene settings on.
script = script[script.index('# ── Scene Settings'):].replace('bpy.ops.render.render(write_still=True)', '')
exec(script.replace('world.use_nodes = True\n', ''))  # gone in 5.x; worlds always use nodes

s = bpy.context.scene
rig = bpy.data.objects['HeroTPP_Character']
mesh = bpy.data.objects['SK_MannequinMesh']
keep = {rig, mesh, *(bpy.data.objects[n] for n in ('floor', 'wall', 'wall_front'))}
for o in bpy.data.objects:  # widget shapes and the mobile rig are render-enabled in his file
    if o.type != 'CAMERA':
        o.hide_render = o not in keep
rig.scale = (0.01, 0.01, 0.01)  # rig is in cm; the CLI scene is in metres

# His pose is not keyed: the "T-Pose" action (keys every CS_ control) would undo it on evaluation.
rig.animation_data.action = None

# Mirror the left arm onto the right. The rig is symmetric (checked below), so the right bone's local transform is
# the left one with X flipped: loc (-x, y, z), quaternion (w, x, -y, -z) - what Blender's flipped paste does.
ARM = ('clavicle', 'upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky', 'elboroll')
flip = mathutils.Matrix.Diagonal((-1, 1, 1, 1))
for pb in rig.pose.bones:
    if not (pb.name.endswith('_l') and any(k in pb.name.lower() for k in ARM)):
        continue
    r = rig.pose.bones[pb.name[:-2] + '_r']
    ml, mr = rig.data.bones[pb.name].matrix_local, rig.data.bones[r.name].matrix_local
    err = max(abs(a - b) for ra, rb in zip(flip @ ml @ flip, mr) for a, b in zip(ra, rb))
    if err > 0.01:
        print('ASYMMETRIC', pb.name, round(err, 3))
    r.location = (-pb.location.x, pb.location.y, pb.location.z)
    q = pb.rotation_quaternion
    r.rotation_quaternion = (q.w, q.x, -q.y, -q.z)
    r.scale = pb.scale
rig['Ik Arm R'], rig['Ik hand R Lock'] = rig['IK Arm L'], rig['Ik Hand L Lock']
# Legs closer together (Fabio 2026-10-23): feet from x +-17 cm to +-7.
for bone, dx in (('CS_FootMainIK_L', -10), ('CS_FootMainIK_R', 10)):
    pb = rig.pose.bones[bone]
    m = pb.matrix.copy()
    m.translation.x += dx
    pb.matrix = m
    bpy.context.view_layer.update()
ev = rig.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones
for n in ('hand', 'lowerarm', 'foot'):
    print('CHECK', n, tuple(round(x, 1) for x in ev[n + '_l'].head), tuple(round(x, 1) for x in ev[n + '_r'].head))

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
rig.color = mesh.color = (0.6, 0.6, 0.6, 1)
bpy.ops.wm.save_mainfile()
print('saved', bpy.data.filepath)
