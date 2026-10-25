# Lists what cosmo_previews.blend holds (objects, materials, lights, world, engine) before the soft restyle.
# Usage: blender -b out/cosmo_previews.blend --python soft_inventory.py
import bpy

s = bpy.context.scene
print('ENGINE', s.render.engine, s.render.resolution_x, s.render.resolution_y, s.view_settings.view_transform)
print('WORLD', s.world.name if s.world else None)
for o in s.objects:
    if o.type == 'CAMERA':
        continue
    mats = [m.name for m in getattr(o.data, 'materials', [])] if o.data else []
    print('OBJ', o.type, o.name, 'hidden' if o.hide_render else 'shown', [round(v, 2) for v in o.dimensions], mats)
print('CAMS', sorted(o.name for o in s.objects if o.type == 'CAMERA'))
