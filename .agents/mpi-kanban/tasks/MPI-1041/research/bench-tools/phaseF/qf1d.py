"""MPI-1041 F1 part 4: a MATCH pass - a second edit on a result whose panels disagree, telling the back view and the
close-up to follow the front. Inputs = this bench's own failed outputs. usage: qf1d.py <out_dir>. Under gpu_lease only.
"""
import json, os, shutil, subprocess, sys

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
IN = 'G:/ComfyUi/ComfyUI/input'
KEEP = 'Keep everything else exactly as it is.'
M1 = ('Make the close-up portrait on the right match the full-body views: the same clothes and the same accessories, '
      'as they would be seen from that angle. ' + KEEP)
M2 = ('Make the character wear exactly the same clothes and accessories in every view of this character sheet, copied '
      'from the front view on the left. ' + KEEP)
SRC = [   # (failed output, lock)
    ('a0_acc_photo_s42', 0),      # back view lost the scarf
    ('a0_acc_fisher_s42', 0),     # close-up lost the scarf
    ('c0_dress_fabio_s1497140120', 1),   # Fabio's failure reproduced: close-up a halter, front short sleeves
]


def main():
    out = sys.argv[1]
    for name, lock in SRC:
        staged = f'mpi1041f1m_{name}.png'
        if not os.path.exists(f'{IN}/{staged}'):
            shutil.copy(f'{out}/{name}.png', f'{IN}/{staged}')
        for k, p in (('m1', M1), ('m2', M2)):
            tag = f'{k}_{name}'
            if os.path.exists(f'{out}/{tag}.png'):
                continue
            spec = [{'tag': tag, 'api': API, 'set': {'Input_Image': {'string': staged}, 'Input_Positive': {'string': p},
                                                     'Input_Seed': {'int': 42}, 'Input_Lock': {'int': lock}}}]
            sp = f'{out}/spec_{tag}.json'
            json.dump(spec, open(sp, 'w', encoding='utf-8'), indent=1)
            if subprocess.run([sys.executable, RUN_API, out, sp]).returncode:
                print('CASE FAILED', tag, flush=True)


if __name__ == '__main__':
    main()
