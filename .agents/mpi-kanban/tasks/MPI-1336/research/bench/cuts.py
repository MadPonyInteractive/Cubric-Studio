"""List hard cuts inside clips (frame diff > 8x the clip median). usage: python cuts.py br_b0.mp4 [...]"""
import subprocess, sys
import numpy as np

IN, W, H = "G:/ComfyUi/ComfyUI/input/mpi1336/", 192, 336
for name in sys.argv[1:]:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", IN + name, "-vf", f"scale={W}:{H}",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    x = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
    d = np.abs(np.diff(x, axis=0)).mean(axis=(1, 2, 3))
    med = np.median(d)
    print(name, f"median {med:.2f}", "cuts at frame:", [(i + 1, round(float(v), 1)) for i, v in enumerate(d) if v > 8 * med])
