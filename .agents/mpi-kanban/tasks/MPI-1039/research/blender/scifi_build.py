# Cosmo previews, SCI-FI SERVER ROOM (Fabio 2026-10-25, after the soft grey studio: "a more sci-fi server room, more
# in tune with our product and design"). Same Cosmo, cameras, lights and render settings as soft_build.py; only the
# room changes: the two grey planes become a closed server room - rows of dark racks on all four walls with small
# LEDs in the family accents (DESIGN.md: Vision rose, frost cyan, Audio green), a glossy raised-floor tile grid with a
# rose glow line at the rack feet, and a dark ceiling with cool light strips. The room is wider than the old one
# (racks start 3.4 from Cosmo) so every preview camera (radius <= 2.6) stays inside it, the Far away lens too.
# Room meshes cast no shadow (as in soft_build.py), so soft_render.py's per-camera key still reaches Cosmo.
# Usage: blender-5.2 -b out/cosmo_soft.blend --python scifi_build.py      (writes out/cosmo_scifi.blend only)
import os
import random
import bmesh
import bpy

OUT = os.path.dirname(os.path.abspath(__file__)) + '/out'
s = bpy.context.scene
rng = random.Random(7)

# DESIGN.md "The accent family", oklch -> linear sRGB (clamped).
ROSE, FROST, AUDIO = (1.0, 0.209, 0.47), (0.066, 0.681, 0.991), (0.193, 0.76, 0.524)

INNER, DEPTH, HEIGHT, CEIL = 3.4, 0.8, 2.3, 3.3  # rack fronts at +-INNER, walls behind them, ceiling height
RACK_W = 0.62


def mat(name, rgb, rough, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def floor_mat():
    # Raised-floor tiles: Brick texture with square bricks, no offset, thin dark seams; glossy so the LEDs reflect.
    m = mat('scifi_floor', (0.03, 0.026, 0.032), 0.22, metal=0.3)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    co = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = 0.0
    br.inputs['Color1'].default_value = (0.045, 0.04, 0.05, 1)
    br.inputs['Color2'].default_value = (0.035, 0.031, 0.04, 1)
    br.inputs['Mortar'].default_value = (0.006, 0.005, 0.007, 1)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.012
    br.inputs['Brick Width'].default_value = 0.6
    br.inputs['Row Height'].default_value = 0.6
    nt.links.new(co.outputs['Object'], br.inputs['Vector'])
    nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
    return m


def box(bm, cx, cy, cz, sx, sy, sz, mi):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r['verts']:
        v.co.x = cx + v.co.x * sx
        v.co.y = cy + v.co.y * sy
        v.co.z = cz + v.co.z * sz
    for f in {f for v in r['verts'] for f in v.link_faces}:
        f.material_index = mi


def new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    s.collection.objects.link(o)
    o.visible_shadow = False
    return o


# Old room out.
for name in ('floor', 'wall', 'wall_front'):
    o = s.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)

M_RACK = mat('scifi_rack', (0.02, 0.017, 0.022), 0.5, metal=0.4)
M_UNIT = mat('scifi_unit', (0.075, 0.068, 0.08), 0.32, metal=0.7)
M_VENT = mat('scifi_vent', (0.008, 0.007, 0.009), 0.7)
M_ROSE = mat('scifi_led_rose', ROSE, 0.3, emit=ROSE, strength=14)
M_FROST = mat('scifi_led_frost', FROST, 0.3, emit=FROST, strength=10)
M_AUDIO = mat('scifi_led_audio', AUDIO, 0.3, emit=AUDIO, strength=8)
M_WALL = mat('scifi_wall', (0.025, 0.021, 0.028), 0.6)
M_CEIL = mat('scifi_ceiling', (0.02, 0.018, 0.022), 0.6)
M_STRIP = mat('scifi_strip', (0.8, 0.85, 0.95), 0.3, emit=(0.8, 0.88, 1.0), strength=4)
M_GLOW = mat('scifi_glow', ROSE, 0.3, emit=ROSE, strength=6)

# Racks: one bmesh for all four walls. Each wall is laid out in its own frame (u along the wall, n toward Cosmo) and
# mapped to world by `place`; a rack is a body, ~11 server units on its front, each with a vent and a few LEDs.
racks = bmesh.new()
WALLS = (  # (origin of the rack fronts, u axis, inward normal)
    ((0, INNER), (1, 0), (0, -1)),
    ((0, -INNER), (1, 0), (0, 1)),
    ((INNER, 0), (0, 1), (-1, 0)),
    ((-INNER, 0), (0, 1), (1, 0)),
)
N_RACKS = 10  # 10 x 0.62 = 6.2 m of racks per wall; the corners stay open so two walls never overlap
LED_MATS = (3, 3, 3, 3, 4, 4, 5)  # mostly rose, some frost, a little green
for (ox, oy), (ux, uy), (nx, ny) in WALLS:
    def place(u, n, z, su, sn, sz, mi):
        cx, cy = ox + ux * u + nx * n, oy + uy * u + ny * n
        sx, sy = abs(ux) * su + abs(nx) * sn, abs(uy) * su + abs(ny) * sn
        box(racks, cx, cy, z, sx, sy, sz, mi)

    for i in range(N_RACKS):
        u = (i - (N_RACKS - 1) / 2) * RACK_W
        place(u, -DEPTH / 2, HEIGHT / 2, RACK_W - 0.03, DEPTH, HEIGHT, 0)
        z = 0.22
        while z < HEIGHT - 0.2:
            h = rng.choice((0.09, 0.09, 0.18))
            place(u, 0.012, z + h / 2, RACK_W - 0.1, 0.025, h - 0.012, 1)
            place(u - 0.06, 0.026, z + h / 2, 0.3, 0.004, h * 0.45, 2)  # vent slot
            for k in range(rng.randint(1, 4)):
                if rng.random() < 0.8:
                    place(u + 0.12 + k * 0.035, 0.028, z + h / 2, 0.018, 0.006, 0.018, rng.choice(LED_MATS))
            z += h + 0.006
        place(u, 0.03, 0.08, RACK_W - 0.03, 0.02, 0.012, 6)  # rose glow line at the rack foot
new_obj('scifi_racks', racks, (M_RACK, M_UNIT, M_VENT, M_ROSE, M_FROST, M_AUDIO, M_GLOW))

# Floor, walls behind the racks, ceiling with light strips.
shell = bmesh.new()
W = INNER + DEPTH + 0.1
box(shell, 0, 0, -0.05, 2 * W, 2 * W, 0.1, 0)
for sx, sy, cx, cy in ((2 * W, 0.1, 0, W), (2 * W, 0.1, 0, -W), (0.1, 2 * W, W, 0), (0.1, 2 * W, -W, 0)):
    box(shell, cx, cy, CEIL / 2, sx, sy, CEIL, 1)
box(shell, 0, 0, CEIL + 0.05, 2 * W, 2 * W, 0.1, 2)
for x in (-1.6, 0, 1.6):
    box(shell, x, 0, CEIL - 0.01, 0.12, 2 * INNER - 0.6, 0.02, 3)
new_obj('scifi_shell', shell, (floor_mat(), M_WALL, M_CEIL, M_STRIP))

# Darker world and the overhead light just under the new ceiling (the ceiling casts no shadow anyway).
bg = s.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.03, 0.025, 0.035, 1)
bg.inputs['Strength'].default_value = 0.4
s.objects['soft_top'].location.z = CEIL - 0.1
# The key and fill sit close to the dark floor and ceiling, which show their spill as bright pools: light-link them
# so they leave the room out and only light Cosmo; the room glows from its own LEDs and strips.
room_col = bpy.data.collections.new('scifi_room')
for name in ('scifi_racks', 'scifi_shell'):
    room_col.objects.link(s.objects[name])
for name in ('soft_key', 'soft_fill'):
    link = s.objects[name].light_linking
    link.receiver_collection = room_col
for c in room_col.collection_objects:
    c.light_linking.link_state = 'EXCLUDE'

bpy.ops.wm.save_as_mainfile(filepath=OUT + '/cosmo_scifi.blend', copy=True)
print('saved', OUT + '/cosmo_scifi.blend')
