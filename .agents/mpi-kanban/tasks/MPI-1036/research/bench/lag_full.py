# Sync of a STITCHED run against its source, with no saved crops: the edited box is found from where the run
# differs from the source, and lag is measured inside it below the edit band (its lower 55%), as lag.py does on
# crops. Usage: python lag_full.py SOURCE.mp4 RUN.mp4 [RUN.mp4 ...]
import subprocess, sys
import numpy as np


def frames(p, w=144, h=256):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                       capture_output=True, check=True).stdout
    return np.frombuffer(r, np.uint8).reshape(-1, h, w).astype(float)


src = frames(sys.argv[1])
for run in sys.argv[2:]:
    out = frames(run)
    n = min(len(src), len(out))
    d = np.abs(out[:n] - src[:n]).mean(0) > 8.0  # codec noise sits under ~3; a re-render inside the box well over
    ys, xs = np.nonzero(d)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    yb = y0 + int(0.45 * (y1 - y0))  # below the edit band
    a, b = src[:n, yb:y1, x0:x1], out[:n, yb:y1, x0:x1]
    off = np.array([min(range(max(0, j - 12), min(n, j + 13)), key=lambda i: np.abs(a[i] - b[j]).mean()) - j for j in range(n)])
    print(f'{run.split("/")[-1]:32s} box {x0},{y0}-{x1},{y1}  mean |lag| {np.abs(off).mean():.2f}  fast 5-34 {np.abs(off[5:35]).mean():.2f}'
          f'  worst {off.min()}..{off.max()}')
