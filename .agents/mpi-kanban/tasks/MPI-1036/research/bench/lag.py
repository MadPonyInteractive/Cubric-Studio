# MPI-1036: how far H3's crop output runs behind/ahead of the crop it was given. For each output frame, the input
# frame (+-12) it best matches below the edit band; negative = output lags. Usage: python lag.py RUN [RUN ...]
import subprocess, sys
import numpy as np

O = 'D:/WORK/Images/Outputs/mpi1036'


def gray(p, s=96):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vf', f'scale={s}:{s}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                       capture_output=True, check=True).stdout
    return np.frombuffer(r, np.uint8).reshape(-1, s, s).astype(float)[:, 40:, :]


for run in sys.argv[1:]:
    a, b = gray(f'{O}/{run}_crop_in_00001.mp4'), gray(f'{O}/{run}_crop_out_00001.mp4')
    off = [min(range(max(0, j - 12), min(len(a), j + 13)), key=lambda i: np.abs(a[i] - b[j]).mean()) - j for j in range(len(b))]
    off = np.array(off)
    print(f'{run:12s} mean |lag| {np.abs(off).mean():.2f}  fast frames 5-34 {np.abs(off[5:35]).mean():.2f}  worst {off.min()}..{off.max()}'
          f'  frames lagging 2+: {(off <= -2).sum()}/{len(off)}')
