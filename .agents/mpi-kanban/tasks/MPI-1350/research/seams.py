"""MPI-1350: does a windowed refine show anything at its window edges?

usage: python seams.py <output.mp4> <source.mp4> <edge_frame> [<edge_frame> ...]
Per frame: mean abs diff to the previous frame (0-255, grey, 288x512) for the output and
the source, and their ratio. A seam shows as a spike in the output that the source does
not have. Edge frames are the windows' first/last overlap frames (latent * 4).
"""
import subprocess, sys
import numpy as np

W, H = 288, 512


def frames(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}",
                                   "-pix_fmt", "gray", "-f", "rawvideo", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)


out, src = frames(sys.argv[1]), frames(sys.argv[2])
n = min(len(out), len(src))
d_out = np.abs(np.diff(out[:n], axis=0)).mean(axis=(1, 2))
d_src = np.abs(np.diff(src[:n], axis=0)).mean(axis=(1, 2))
ratio = d_out / np.maximum(d_src, 0.5)
edges = [int(e) for e in sys.argv[3:]]
print(f"frames {n}  out diff median {np.median(d_out):.2f} p95 {np.percentile(d_out, 95):.2f}  "
      f"ratio median {np.median(ratio):.2f} p95 {np.percentile(ratio, 95):.2f} max {ratio.max():.2f} @ {ratio.argmax() + 1}")
for i in range(n - 1):
    near = any(abs(i + 1 - e) <= 2 for e in edges)
    if near or ratio[i] > np.percentile(ratio, 95):
        print(f"  frame {i + 1:4d}  out {d_out[i]:5.2f}  src {d_src[i]:5.2f}  ratio {ratio[i]:4.2f}"
              f"{'  <- edge' if near else ''}")
