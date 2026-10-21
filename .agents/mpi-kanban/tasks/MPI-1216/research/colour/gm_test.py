# MpiNodes fit_grade on the whole frame (no mask): drift fixed? new content kept? night edit size?
import importlib.util, time, numpy as np, torch
from PIL import Image
spec = importlib.util.spec_from_file_location('grade', 'C:/AI/Mpi/ComfyUi-MpiNodes/grade.py')
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
M = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Flux 3 tests/Media/'
IN = 'G:/ComfyUi/ComfyUI/input/'
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5499a12a-9d36-4bc1-b229-4b8966f5efec/scratchpad/'
ld = lambda p: torch.from_numpy(np.asarray(Image.open(p).convert('RGB'), dtype=np.float32) / 255)


def regrade(out, ref):
    a, b = g.fit_grade(out.reshape(-1, 3), ref.reshape(-1, 3))
    fixed = (out * a + b).clamp(0, 1)
    return fixed, (fixed - out).abs().mean().item() * 255


chains = {
    'gm_null': [IN + 'mpi1216c_t003.png'] + [IN + f'mpi1216c_Ntn{i}.png' for i in (1, 2, 3)],
    'gm_real': [M + 'edit_044.png', IN + 'mpi1216c_Rn45.png', IN + 'mpi1216c_Rn46.png'],
}
for name, fs in chains.items():
    prev = ld(fs[0])
    for i, f in enumerate(fs[1:], 1):
        t = time.time()
        fixed, corr = regrade(ld(f), prev)
        print(name, i, f'correction {corr:.2f}/255, {time.time()-t:.2f} s')
        Image.fromarray((fixed.numpy() * 255).round().astype(np.uint8)).save(S + f'{name}{i}.png')
        prev = fixed
ref = ld(IN + 'mpi1216c_t003.png')
for label, night in [('night', ref * torch.tensor([0.45, 0.5, 0.7]) + torch.tensor([0, 0.01, 0.04])),
                     ('warmer', (ref * torch.tensor([1.06, 1.0, 0.92])).clamp(0, 1))]:
    print(label, f'correction {regrade(night, ref)[1]:.2f}/255')
