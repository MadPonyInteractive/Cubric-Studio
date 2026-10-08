# MPI-1036 Phase 2 review: frame grid (source + each run at the same timestamps), a side-by-side VP9 WebM
# for the Desktop panel (H.264 plays black there), and how far each run drifted from the source OUTSIDE the
# ear mask (grown 40 px) - the pixels a mask path promises to leave alone.
# Usage: python compare_mask.py OUT NAME=path.mp4 [NAME=path.mp4 ...]
import subprocess, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = r'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/d8220b88-ca41-4225-b100-4ec4a02846cf/scratchpad'
SRC = r'G:/ComfyUi/ComfyUI/input/mpi1036_ears_last3s_24fps.mp4'
MASK = r'D:/WORK/Images/Outputs/mpi1036/preview_mask_00001.mp4'
TIMES = [0.3, 1.1, 1.6, 2.6]
W, H = 576, 1024
OUT = sys.argv[1]
runs = [('source', SRC)] + [tuple(a.split('=', 1)) for a in sys.argv[2:]]


def frame(path, t, gray=False):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', path, '-frames:v', '1', '-vf', f'scale={W}:{H}',
                          '-f', 'rawvideo', '-pix_fmt', 'gray' if gray else 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape((H, W) if gray else (H, W, 3))


src = [frame(SRC, t) for t in TIMES]
keep = []  # True = outside the grown ear mask
for t in TIMES:
    m = Image.fromarray(frame(MASK, t, gray=True)).point(lambda v: 255 if v > 64 else 0).filter(ImageFilter.MaxFilter(81))
    keep.append(np.array(m) == 0)

TW, TH = 288, 512
grid = Image.new('RGB', (TW * len(TIMES), (TH + 22) * len(runs)), 'black')
d = ImageDraw.Draw(grid)
for r, (name, path) in enumerate(runs):
    y, diffs = r * (TH + 22), []
    for c, t in enumerate(TIMES):
        f = src[c] if name == 'source' else frame(path, t)
        if name != 'source':
            diffs.append(np.abs(f.astype(int) - src[c].astype(int))[keep[c]].mean())
        grid.paste(Image.fromarray(f).resize((TW, TH)), (c * TW, y + 22))
    label = name if name == 'source' else f'{name}  outside-mask diff {np.mean(diffs):.2f}/255'
    d.text((4, y + 4), label, fill='white')
    if name != 'source':
        print(f'{name}: outside-mask mean abs diff vs source {np.mean(diffs):.2f}/255 (per frame {[round(x, 2) for x in diffs]})')
grid.save(f'{S}/{OUT}_grid.jpg', quality=90)
print('grid', f'{S}/{OUT}_grid.jpg')

ins, flt = [], []
for i, (name, p) in enumerate(runs):
    ins += ['-i', p]
    # Fabio reads the picture, not the caption: each column carries its plain-English name (underscores = spaces)
    label = 'Original' if name == 'source' else name.replace('_', ' ')
    flt.append(f"[{i}:v]fps=24,scale=432:768,setsar=1,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='{label}'"
               f":x=(w-text_w)/2:y=10:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8[v{i}]")
flt.append(''.join(f'[v{i}]' for i in range(len(runs))) + f'hstack=inputs={len(runs)}[out]')
out = f'{S}/{OUT}_side_by_side.webm'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(flt), '-map', '[out]', '-map', '0:a?',
                '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-c:a', 'libopus', '-shortest', out], check=True)
print('clip', out, os.path.getsize(out))
