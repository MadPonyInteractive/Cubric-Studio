# Never saves the .blend. Compositor OFF so the file's File Output nodes write nothing into MultiControlnet/.
import bpy
s = bpy.context.scene
s.render.use_compositing = False
s.render.use_sequencer = False
s.render.engine = 'BLENDER_WORKBENCH'
sh = s.display.shading
sh.light = 'FLAT'
sh.color_type = 'SINGLE'
sh.single_color = (0.55, 0.55, 0.55)
sh.background_type = 'VIEWPORT'
sh.background_color = (0.12, 0.12, 0.12)
sh.show_shadows = False
sh.show_cavity = False
sh.show_object_outline = False
s.render.film_transparent = False
s.render.image_settings.file_format = 'PNG'
s.render.resolution_percentage = 50
print('view layer', bpy.context.view_layer.name)
vis = [o.name for o in s.objects if o.visible_get() and o.type == 'MESH' and not o.name.startswith('cs_')]
print('visible meshes', vis)
s.render.filepath = r'C:\Users\Fabio\AppData\Local\Temp\claude\C--AI-Mpi-Cubric-Vision\67c2e6b6-6d56-46e6-b5f2-e52e6dec6a1e\scratchpad\flat_flat'
bpy.ops.render.render(write_still=True)
sh.light = 'STUDIO'
s.render.filepath = s.render.filepath.replace('flat_flat', 'flat_studio')
bpy.ops.render.render(write_still=True)
