# Cosmo previews, SOFT look (Fabio 2026-10-25, after the flat line-art previews): a lit plastic toy in a soft studio
# corner, like his FLUX.3 3D render of Cosmo - instead of flat emission + Freestyle lines. Same cameras, same boxes and
# art decals, so every preview still shows the exact view of its doll ref. What changes: Principled plastic for the
# body (slight coat for the sheen), the art decals lit too, a metal headset ring + antenna, rounder bevels with
# hardened normals (the box edges catch a highlight), a warm light-grey room, and a soft key light that sits up and
# to the LEFT of whichever camera renders (soft_render.py moves it), so all 24 views are lit the same way.
# Usage: blender-5.2 -b out/cosmo_previews.blend --python soft_build.py      (writes out/cosmo_soft.blend only)
import os
import bpy

OUT = os.path.dirname(os.path.abspath(__file__)) + '/out'
s = bpy.context.scene
BODY = (0.3564, 0.1529, 0.1441)  # #a16d6a, the app's Cosmo body (cosmo_build.py)


def principled(name, rgb, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = 0.25
    return m


plastic = principled('soft_body', BODY, 0.42, coat=0.35)
metal = principled('soft_metal', (0.42, 0.33, 0.28), 0.3, metal=1.0)
dark = principled('soft_dark', (0.02, 0.012, 0.015), 0.45)
room = principled('soft_room', (0.42, 0.40, 0.38), 0.85)

for o in s.objects:
    if o.type != 'MESH' or o.hide_render:
        continue
    if o.name in ('floor', 'wall', 'wall_front'):
        o.data.materials.clear()
        o.data.materials.append(room)
        o.visible_shadow = False  # a key light that lands behind a wall on some turns still reaches Cosmo
        continue
    if not o.name.startswith('Cosmo_'):
        continue
    if o.name.startswith(('Cosmo_face', 'Cosmo_chest')):
        # The decal keeps its art, now lit: emission -> Principled fed by the same image, alpha cut-out kept.
        nt = o.active_material.node_tree
        tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
        # soft_tex.py's copy: outline + pink fill cut out, so the lit plastic shows through.
        tex.image = bpy.data.images.load(tex.image.filepath.replace('.png', '_soft.png'))
        em = next(n for n in nt.nodes if n.type == 'EMISSION')
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        b.inputs['Roughness'].default_value = 0.35
        b.inputs['Coat Weight'].default_value = 0.35
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
        mix = next(n for n in nt.nodes if n.type == 'MIX_SHADER')
        nt.links.new(b.outputs[0], mix.inputs[2])
        nt.nodes.remove(em)
        continue
    o.data.materials.clear()
    o.data.materials.append(metal if o.name.startswith(('Cosmo_ear_ring', 'Cosmo_antenna')) else plastic)
    bev = o.modifiers.get('Bevel')
    if bev:
        bev.segments = 6
        bev.harden_normals = True
    for p in o.data.polygons:
        p.use_smooth = True

# Lights: key + fill are placed per camera by soft_render.py; the overhead one is fixed.
for name, energy, size in (('soft_key', 900, 2.5), ('soft_fill', 120, 3.0), ('soft_top', 300, 4.0)):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size = energy, size
    obj = bpy.data.objects.new(name, light)
    s.collection.objects.link(obj)
    if name == 'soft_top':
        obj.location = (0, 0, 4.5)
    else:
        aim = obj.constraints.new('TRACK_TO')
        aim.target = s.objects['Cosmo_torso']
        aim.track_axis, aim.up_axis = 'TRACK_NEGATIVE_Z', 'UP_Y'

s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.48, 0.46, 1)
s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.15

# 16:9 to fill the gizmo's stage (Fabio 2026-10-25). The vertical field of view stays what the square frame had, so
# Cosmo is framed exactly as his doll ref and the room just widens at the sides.
s.render.resolution_x, s.render.resolution_y = 960, 540
for c in (o.data for o in s.objects if o.type == 'CAMERA'):
    c.sensor_fit, c.sensor_height = 'VERTICAL', c.sensor_width

s.render.use_freestyle = False
# EEVEE (Fabio 2026-10-25): good soft lighting in seconds a frame, so all 24 stops render in a minute.
s.render.engine = 'BLENDER_EEVEE'
s.eevee.taa_render_samples = 160
s.eevee.use_raytracing = True
s.eevee.use_shadows = True
s.view_settings.view_transform = 'AgX'
s.view_settings.look = 'AgX - Punchy'
s.render.use_compositing = False
s.render.image_settings.file_format = 'PNG'
bpy.ops.wm.save_as_mainfile(filepath=OUT + '/cosmo_soft.blend', copy=True)
print('saved', OUT + '/cosmo_soft.blend')
