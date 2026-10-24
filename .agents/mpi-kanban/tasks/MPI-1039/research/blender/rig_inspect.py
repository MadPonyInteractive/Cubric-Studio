# Read-only dump of how the UE4 rig drives its limbs and what the saved pose holds.
# Usage: blender -b <file.blend> --python rig_inspect.py      Never saves.
# Finding (2026-10-24): arms = IK on CS_lowerarm_* -> CS_ik_hand_* (parentless) unless 'IK Arm L'/'Ik Arm R' = 0;
# legs = IK on CS_calf_* -> CS_ik_foot_* (under CS_FootMainIK_*). Deform bones COPY_ROTATION from the CS_ bones.
# A "T-Pose" action keys every CS_ control: a pose that is not keyed is undone on evaluation.
import bpy

s = bpy.context.scene
rig = bpy.data.objects['HeroTPP_Character']
print('UNITS', s.unit_settings.system, s.unit_settings.scale_length, 'RIG', tuple(rig.location), tuple(rig.scale),
      tuple(round(x, 3) for x in rig.rotation_euler), 'frame', s.frame_current)
for o in bpy.data.objects:
    print('OBJ', o.type, o.name, 'parent', o.parent and o.parent.name, 'render', not o.hide_render,
          'view', o.visible_get(), [c.name for c in o.users_collection])
act = rig.animation_data and rig.animation_data.action
print('ACTION', act, 'IK', {k: rig[k] for k in rig.keys() if k.lower().startswith(('ik', 'foot'))})
keyed = {}
if act:
    for fc in act.fcurves if hasattr(act, 'fcurves') else []:
        if '"' in fc.data_path:
            keyed[(fc.data_path.split('"')[1], fc.data_path.rsplit('.', 1)[1], fc.array_index)] = fc.evaluate(s.frame_current)
print('KEYED channels', len(keyed))
for pb in rig.pose.bones:
    if not pb.name.startswith(('CS_', 'IK', 'ik')) or any(f in pb.name for f in ('index', 'middle', 'ring', 'pinky', 'thumb')):
        continue
    vals = {'location': pb.location, 'rotation_quaternion': pb.rotation_quaternion}
    diffs = [(p, i, round(v[i], 3), round(keyed[(pb.name, p, i)], 3)) for p, v in vals.items() for i in range(len(v))
             if (pb.name, p, i) in keyed and abs(v[i] - keyed[(pb.name, p, i)]) > 1e-3]
    nonrest = any(abs(x) > 1e-3 for x in pb.location) or abs(pb.rotation_quaternion[0] - 1) > 1e-3
    if nonrest or diffs:
        print(pb.name, 'loc', tuple(round(x, 2) for x in pb.location), 'q', tuple(round(x, 3) for x in pb.rotation_quaternion),
              'UNKEYED-DIFF' if diffs else '', diffs[:3])
