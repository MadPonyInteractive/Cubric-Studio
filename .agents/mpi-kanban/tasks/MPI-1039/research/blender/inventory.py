import bpy
s = bpy.context.scene
print('== scene', s.name, 'engine', s.render.engine, s.render.resolution_x, s.render.resolution_y, 'camera', s.camera and s.camera.name)
print('== scenes', [x.name for x in bpy.data.scenes])
print('== world', s.world and s.world.name)


def walk(lc, d=0):
    c = lc.collection
    print('  ' * d + f'[{c.name}] excl={lc.exclude} hide_render={c.hide_render} objs={len(c.objects)}')
    for ch in lc.children:
        walk(ch, d + 1)


print('== collections (view layer', bpy.context.view_layer.name, ')')
walk(bpy.context.view_layer.layer_collection)
print('== cameras')
for o in bpy.data.objects:
    if o.type == 'CAMERA':
        print(' ', o.name, tuple(round(v, 2) for v in o.matrix_world.translation), 'lens', o.data.lens, 'type', o.data.type)
print('== armatures')
for o in bpy.data.objects:
    if o.type == 'ARMATURE':
        b = o.pose.bones
        ctl = [x.name for x in b if x.name.startswith('c_')]
        print(' ', o.name, 'bones', len(b), 'c_ controls', len(ctl), ctl[:60])
print('== meshes (visible in render)')
for o in bpy.data.objects:
    if o.type == 'MESH' and not o.hide_render:
        print(' ', o.name, 'mods', [m.type for m in o.modifiers][:6], 'mats', [m.name for m in o.data.materials if m][:3])
print('== lights', [(o.name, o.data.type) for o in bpy.data.objects if o.type == 'LIGHT'])
print('== addons enabled', [a.module for a in bpy.context.preferences.addons])
print('== text blocks', [t.name for t in bpy.data.texts])
