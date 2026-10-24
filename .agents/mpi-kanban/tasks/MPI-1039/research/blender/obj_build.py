# Object stand-in refs (round 8, Fabio 2026-10-24): round 7 pasted the mannequin into object edits and lost the back
# and 3/4 views. A yellow stand-in (Fabio: yellow for contrast) with an obvious FRONT (white panel + black disc) and a
# plain yellow BACK, floating at the body cameras' aim height. `box` (default) = the speaker's wide block with a dark
# tab on its frame-right end (the strap side); `bottle` = an upright flask with a neck and a dark cap (round 9: the
# perfume-bottle source, Fabio: the speaker is too close to the box to be a fair rotation test).
# Opens Fabio's posed file, hides the mannequin, drops the face cameras, and saves a NEW file - the posed file is never
# written. `cube` (round 17, Fabio: the box and the flask were each built to their own product's shape) = ONE generic
# stand-in for every product: a plain cube, the panel marks the face the source shows; it also adds zoom cameras
# <cam>_near / <cam>_far (same position, longer / shorter lens) for front_hi and tq_fl.
# `house` (round 18) = the generic stand-in with every side told apart, on a plinth - see its branch below.
# Usage: blender-5.2 -b out/UE4_Mannequinn_refs.blend --python obj_build.py [-- bottle | cube | house]   then render
# out/<shape>_refs.blend with ref_render.py (it reads StandIn's `refdir` and writes to out/<refdir>/).
import os
import sys
import bpy

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
shape = next((a for a in args if a in ('bottle', 'cube', 'house')), 'box')
for name in ('SK_MannequinMesh', 'HeroTPP_Character'):
    bpy.data.objects[name].hide_render = bpy.data.objects[name].hide_viewport = True
for cam in [o for o in bpy.data.objects if o.type == 'CAMERA' and o.name.startswith('face_')]:
    bpy.data.objects.remove(cam)
YELLOW, WHITE, BLACK, DARK = (0.9, 0.72, 0.08), (0.9, 0.9, 0.9), (0.04, 0.04, 0.04), (0.12, 0.12, 0.12)


def box(name, loc, size, rgb):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name, o.scale, o.color = name, [v / 2 for v in size], (*rgb, 1)
    return o


def cyl(name, loc, r, depth, rgb, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name, o.color = name, (*rgb, 1)
    return o


if shape == 'box':
    box('StandIn', (0, 0, 0.9), (1.1, 0.4, 0.55), YELLOW)
    box('StandIn_front', (0, -0.205, 0.9), (0.98, 0.01, 0.43), WHITE)  # the front face, just proud of the box
    cyl('StandIn_disc', (0, -0.212, 0.9), 0.15, 0.01, BLACK, (1.5708, 0, 0))
    box('StandIn_tab', (0.6, 0, 0.9), (0.1, 0.14, 0.24), DARK)  # +X = frame-right from the front
elif shape == 'cube':
    box('StandIn', (0, 0, 0.9), (0.5, 0.5, 0.5), YELLOW)
    box('StandIn_front', (0, -0.255, 0.9), (0.4, 0.01, 0.4), WHITE)
    for name in ('front_hi', 'tq_fl'):
        cam = bpy.data.objects[name]
        for tag, k in (('near', 1.8), ('far', 0.55)):
            twin = cam.copy()
            twin.data = cam.data.copy()
            twin.data.lens = cam.data.lens * k
            twin.name = f'{name}_{tag}'
            bpy.context.scene.collection.objects.link(twin)
elif shape == 'house':  # round 18 (Fabio): roof = up, door = front, chimney on the back slope at +X (frame-right)
    # tells left from right and front from back; it stands on a PLINTH (the surface a resting product sits on), so the
    # low cameras see the plinth's edge in front and no underside - round 17's floating cube showed one (low ~2/16)
    box('StandIn_plinth', (0, 0, 0.3), (0.9, 0.9, 0.6), YELLOW)
    box('StandIn', (0, 0, 0.82), (0.5, 0.44, 0.44), YELLOW)
    box('StandIn_door', (0, -0.225, 0.72), (0.13, 0.01, 0.24), WHITE)
    roof = bpy.data.meshes.new('roof')  # a prism, ridge along X, eaves a little proud of the walls
    w, d, z0, z1 = 0.29, 0.26, 1.04, 1.26
    roof.from_pydata([(-w, -d, z0), (w, -d, z0), (w, d, z0), (-w, d, z0), (-w, 0, z1), (w, 0, z1)], [],
                     [(0, 1, 5, 4), (3, 4, 5, 2), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)])
    o = bpy.data.objects.new('StandIn_roof', roof)
    o.color = (*YELLOW, 1)
    bpy.context.scene.collection.objects.link(o)
    box('StandIn_chimney', (0.15, 0.12, 1.24), (0.08, 0.08, 0.2), DARK)
else:  # a flask 0.5 wide, 0.26 deep, 0.62 tall, neck + cap on top; whole thing centred near 0.9
    box('StandIn', (0, 0, 0.75), (0.5, 0.26, 0.62), YELLOW)
    box('StandIn_front', (0, -0.135, 0.73), (0.38, 0.01, 0.4), WHITE)
    cyl('StandIn_disc', (0, -0.142, 0.73), 0.11, 0.01, BLACK, (1.5708, 0, 0))
    cyl('StandIn_neck', (0, 0, 1.12), 0.07, 0.12, YELLOW)
    cyl('StandIn_cap', (0, 0, 1.28), 0.11, 0.2, DARK)
bpy.data.objects['StandIn']['refdir'] = {'box': 'object'}.get(shape, shape)
bpy.ops.wm.save_as_mainfile(filepath=os.path.dirname(os.path.abspath(__file__)) + f'/out/{shape}_refs.blend')
