# KJNodes ColorMatch (mkl, strength 1) emulated: each edit matched to ITS input picture,
# chained (045 matched to 044, 046 to the matched 045). Run with G:\ComfyUi python.
import numpy as np
from PIL import Image
from color_matcher import ColorMatcher
M = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Flux 3 tests/Media/'
IN = 'G:/ComfyUi/ComfyUI/input/'
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5499a12a-9d36-4bc1-b229-4b8966f5efec/scratchpad/'
ld = lambda p: np.asarray(Image.open(p).convert('RGB'), dtype=np.float32) / 255
cm = ColorMatcher()


def match(src, ref):
    return np.clip(cm.transfer(src=src, ref=ref, method='mkl'), 0, 1)


chains = {
    'null_turbo': [IN + 'mpi1216c_t003.png'] + [IN + f'mpi1216c_Ntn{i}.png' for i in (1, 2, 3)],
    'real': [M + 'edit_044.png', IN + 'mpi1216c_Rn45.png', IN + 'mpi1216c_Rn46.png'],
}
for name, fs in chains.items():
    prev = ld(fs[0])
    for i, f in enumerate(fs[1:], 1):
        # the model's output for step i was made from the UNMATCHED previous; ponytail: good enough
        # to show the per-step correction, a true chain would re-run the model on matched inputs.
        out = match(ld(f), prev)
        Image.fromarray((out * 255).round().astype(np.uint8)).save(S + f'cm_{name}{i}.png')
        prev = out
    print(name, 'done')
