# Swaps the UE4 mannequin for Fabio's unisex ControlNet doll (round 24: the UE mannequin's bald head and jointed limbs
# got pasted on back views). Opens out/UE4_Mannequinn_refs.blend (same floor, walls, cameras, render settings), imports
# his OBJ export of the posed doll (Body_Full_01 from D:\Blender\Projects\OpenPoseBonse_V99\mpi_openPose.blend, natural
# pose, modifiers applied - a plain mesh, re-export there to change the pose), fits it to the mannequin's height and
# footprint, hides the mannequin and saves a NEW file out/doll_refs.blend; ref_render.py renders it to out/doll/.
# Usage: blender-5.2 -b out/UE4_Mannequinn_refs.blend --python doll_build.py -- <doll.obj>     Never saves the opened file.
import os
import sys
import bpy

obj = sys.argv[sys.argv.index('--') + 1]
s = bpy.context.scene
rig = bpy.data.objects['HeroTPP_Character']
mesh = bpy.data.objects['SK_MannequinMesh']


def bbox(o):  # world-space min/max of the EVALUATED mesh (the mannequin's pose lives in its armature)
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    pts = [ev.matrix_world @ v.co for v in ev.to_mesh().vertices]
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    ev.to_mesh_clear()
    return lo, hi


before = set(bpy.data.objects)
bpy.ops.wm.obj_import(filepath=obj)
doll = None
for o in set(bpy.data.objects) - before:  # the export also carried his floor, wall and Seg.002
    if o.name.startswith('Body_Full_01'):
        doll = o
    else:
        bpy.data.objects.remove(o)
doll.name = 'Doll'
for p in doll.data.polygons:
    p.use_smooth = True
bpy.context.view_layer.update()

(mlo, mhi), (dlo, dhi) = bbox(mesh), bbox(doll)
k = (mhi[2] - mlo[2]) / (dhi[2] - dlo[2])  # same height as the mannequin, so every camera frames it the same
doll.scale = [c * k for c in doll.scale]
bpy.context.view_layer.update()
dlo, dhi = bbox(doll)
doll.location.x += (mlo[0] + mhi[0]) / 2 - (dlo[0] + dhi[0]) / 2
doll.location.y += (mlo[1] + mhi[1]) / 2 - (dlo[1] + dhi[1]) / 2
doll.location.z += mlo[2] - dlo[2]
print('FIT scale', round(k, 3), 'mannequin', [round(v, 2) for v in mlo + mhi], 'doll', [round(v, 2) for v in dlo + dhi])

for o in (rig, mesh):
    o.hide_render = o.hide_viewport = True
doll.color = (0.80, 0.56, 0.43, 1)  # Fabio: a skin tone, so it stands off the grey walls (the mannequin was 0.6 grey)
s['refdir'] = 'doll'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'doll_refs.blend'),
                            copy=True)
print('saved doll_refs.blend')
