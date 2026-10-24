# Cosmo for the Flow gizmo's previews (Fabio 2026-10-24): an image-to-3D site doubled his front onto his back, so he is
# plain BOXES with the art STAMPED on (Fabio: the boxes carry the shape, the texture carries the screen, eyes, mouth,
# collar, logo and panels). Decals = crops of `Cubric Studio Brand Assets/Studio-Idle.png` in out/cosmo_tex/ (head.png,
# torso.png). Back three-quarter screenshot: plain head + torso back, ear ring with the antenna on top. Sizes are the
# front art's pixels / 1000 (1.83 m tall, the mannequin's frame). Colours: body #a16d6a (Fabio, from the app), lines =
# --surface-viewer oklch(0.20 0.020 350). Everything is flat emission (the art's own colours, no lighting) + Freestyle.
# Opens Fabio's posed file, hides the mannequin, keeps its cameras (previews = the model refs' exact views), saves a NEW
# file out/cosmo.blend - the posed file is never written.
# Usage: blender-5.2 -b out/UE4_Mannequinn_refs.blend --python cosmo_build.py      then render out/cosmo.blend
import os
import bpy

BODY, DARK = (0.3564, 0.1529, 0.1441), (0.0124, 0.0062, 0.0087)
TEX = os.path.dirname(os.path.abspath(__file__)) + '/out/cosmo_tex/'
for name in ('SK_MannequinMesh', 'HeroTPP_Character'):
    bpy.data.objects[name].hide_render = bpy.data.objects[name].hide_viewport = True
for cam in [o for o in bpy.data.objects if o.type == 'CAMERA' and o.name.startswith('face_')]:
    bpy.data.objects.remove(cam)
mats = {}


def flat(key, rgb=None, image=None):  # emission = the colour exactly as drawn; an image decal is cut out by its alpha
    if key in mats:
        return mats[key]
    m = bpy.data.materials.new(f'cosmo_{key}')
    m.diffuse_color = (*(rgb or BODY), 1)
    nt = m.node_tree
    nt.nodes.clear()
    out, em = nt.nodes.new('ShaderNodeOutputMaterial'), nt.nodes.new('ShaderNodeEmission')
    if image:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(TEX + image)
        mix, clear = nt.nodes.new('ShaderNodeMixShader'), nt.nodes.new('ShaderNodeBsdfTransparent')
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
        nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
        nt.links.new(clear.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        m.surface_render_method = 'BLENDED'
    else:
        em.inputs['Color'].default_value = (*rgb, 1)
        nt.links.new(em.outputs[0], out.inputs['Surface'])
    mats[key] = m
    return m


def finish(o, name, m):
    o.name = name
    o.data.materials.append(m)
    return o


def box(name, loc, size, rgb=BODY):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    bpy.context.object.scale = [v / 2 for v in size]
    bpy.ops.object.transform_apply(scale=True)
    return finish(bpy.context.object, name, flat(rgb, rgb))


def decal(name, loc, w, h, image):  # a plane just proud of a box's front face (-Y), the art crop filling it
    bpy.ops.mesh.primitive_plane_add(location=loc, rotation=(1.5708, 0, 0))
    bpy.context.object.scale = (w / 2, h / 2, 1)
    bpy.ops.object.transform_apply(scale=True)
    return finish(bpy.context.object, name, flat(image, image=image))


def cyl(name, loc, r, depth, rgb, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.object, name, flat(rgb, rgb))


def ball(name, loc, scale, rgb=BODY):  # Fabio: the hands (and feet) are just stretched spheres
    bpy.ops.mesh.primitive_uv_sphere_add(location=loc)
    bpy.context.object.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(bpy.context.object, name, flat(rgb, rgb))


box('Cosmo_head', (0, 0, 1.418), (0.97, 0.75, 0.815))
decal('Cosmo_face', (0, -0.377, 1.418), 0.97, 0.815, 'head.png')
for side in (-1, 1):  # ear discs on the sides, a dark ring on each, the antenna rising from it
    cyl('Cosmo_ear', (side * 0.545, 0, 1.403), 0.13, 0.12, BODY, (0, 1.5708, 0))
    cyl('Cosmo_ear_ring', (side * 0.607, 0, 1.403), 0.08, 0.01, DARK, (0, 1.5708, 0))
    cyl('Cosmo_antenna', (side * 0.553, 0, 1.66), 0.016, 0.26, DARK)
box('Cosmo_neck', (0, 0, 0.968), (0.36, 0.3, 0.085))
box('Cosmo_torso', (0, 0, 0.592), (0.93, 0.6, 0.668))
decal('Cosmo_chest', (0, -0.302, 0.592), 0.93, 0.668, 'torso.png')
for side in (-1, 1):
    box('Cosmo_arm', (side * 0.575, 0, 0.625), (0.19, 0.25, 0.57))
    ball('Cosmo_hand', (side * 0.56, 0, 0.29), (0.07, 0.08, 0.1))
    box('Cosmo_leg', (side * 0.2, 0, 0.145), (0.21, 0.22, 0.23))
    ball('Cosmo_foot', (side * 0.2, -0.03, 0.03), (0.155, 0.17, 0.1))

s = bpy.context.scene
s.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in {e.identifier for e in
                                                                  bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items} else 'BLENDER_EEVEE'
s.view_settings.view_transform = 'Standard'  # Filmic/AgX would wash the brand colours
s.render.use_freestyle = True
s.render.line_thickness_mode = 'ABSOLUTE'
s.render.line_thickness = 4.0
fs = s.view_layers[0].freestyle_settings
(fs.linesets[0] if fs.linesets else fs.linesets.new('lines')).linestyle.color = DARK
bpy.ops.wm.save_as_mainfile(filepath=os.path.dirname(os.path.abspath(__file__)) + '/out/cosmo.blend')
