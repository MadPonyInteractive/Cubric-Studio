"""Assemble the per-window 2K refines and measure the joins, the same way MPI-1336's seams.py does.

  python seams_2k.py <clip dir> <arm> [<arm> ...]     arm = ship | regen | base (MPI-1336's unrefined chain)

Frames scaled to 192x336, 0-255. A join diff above the clip's median frame-to-frame diff = visible seam.
"""
import subprocess
import sys

import numpy as np

BASE = "G:/ComfyUi/ComfyUI/input/mpi1336/A_q1032192_w%d.mp4"
W, H, CTX, ADV = 192, 336, 39, 85


def frames(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=%d:%d" % (W, H),
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)


def measure(clips, arm):
    path = BASE if arm == "base" else clips + "/seam_" + arm + "_w%d.mp4"
    wins = [frames(path % i) for i in range(3)]
    out = np.concatenate([wins[0]] + [x[CTX:] for x in wins[1:]])
    d = np.abs(np.diff(out, axis=0)).mean(axis=(1, 2, 3))
    seams = [len(wins[0]) + ADV * i for i in range(len(wins) - 1)]
    joins = " / ".join("%.2f" % d[s - 1] for s in seams)
    heads = " / ".join("%.2f" % np.abs(wins[i][:CTX] - wins[i - 1][ADV:ADV + CTX]).mean() for i in range(1, 3))
    print("| %s | %s | %s | %.2f / %.2f | %s |" % (arm, [len(x) for x in wins], joins, np.median(d),
                                                  np.percentile(d, 95), heads))


def main():
    print("| arm | frames per window | join diff (124 / 209) | median / p95 | preserved head vs prev tail |")
    print("|---|---|---|---|---|")
    for arm in sys.argv[2:]:
        measure(sys.argv[1], arm)


if __name__ == "__main__":
    main()
