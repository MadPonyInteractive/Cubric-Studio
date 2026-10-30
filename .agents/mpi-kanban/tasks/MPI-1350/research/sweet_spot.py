"""MPI-1350: which window ceiling makes a whole clip fastest, given the measured step times?

Fits step seconds = a*T + b*T^2 over T = video frames * output px (M px-frames) from the
16 GB probe (2K and 1 MP together: one curve if cost follows tokens), then plays every
clip length through the sampler's own plan_windows (grid 5, 4 frames per latent,
overlap 17) for each ceiling. Prints the fit and the best ceiling per clip length.
usage: G:/ComfyUi/python_embeded/python.exe sweet_spot.py
"""
import os, sys, types
import numpy as np
import torch, tqdm.auto  # noqa: F401  before the pack root (its json.py shadows the stdlib)

sys.path.insert(0, "C:/AI/Mpi/ComfyUi-MpiNodes")
for n in ("comfy", "comfy.model_management", "comfy.sample", "comfy.utils", "comfy.nested_tensor",
          "latent_preview", "folder_paths"):
    sys.modules.setdefault(n, types.ModuleType(n))
sys.modules["comfy.nested_tensor"].NestedTensor = object
sys.modules["latent_preview"].prepare_callback = None
sys.modules["comfy"].model_management = sys.modules["comfy.model_management"]
import sampler as S  # noqa: E402

A2K, A1M = 1152 * 2048 / 1e6, 768 * 1344 / 1e6
PTS = [(107, A2K, 112), (124, A2K, 135), (141, A2K, 167), (158, A2K, 201), (175, A2K, 240), (192, A2K, 282),
       (243, A1M, 111), (277, A1M, 132), (311, A1M, 159), (345, A1M, 188), (379, A1M, 222), (413, A1M, 258),
       (447, A1M, 296)]
T = np.array([f * a for f, a, _ in PTS]); y = np.array([s for *_, s in PTS], float)
(a, b), *_ = np.linalg.lstsq(np.stack([T, T * T], 1), y, rcond=None)
print(f"step s = {a:.4f}*T + {b:.6f}*T^2  (T = frames x M px)")
for (f, ar, s), t in zip(PTS, T):
    print(f"  {f:4d} @ {ar:.2f} M px: measured {s:4d}  fit {a * t + b * t * t:6.1f}")

GRID, RATIO, OVER = 5, 4, 17


def clip_cost(frames, ceiling, area):
    total = (frames - 1) // RATIO + 1
    window = max(1, S.frames_to_latent(ceiling, GRID, RATIO, total))
    overlap = S.frames_to_latent(OVER, GRID, RATIO, max(0, window - 1))
    spans = S.plan_windows(total, window, overlap, GRID)
    return sum(a * S.latent_to_frames(e - s, GRID, RATIO) * area + b * (S.latent_to_frames(e - s, GRID, RATIO) * area) ** 2
               for s, e in spans)


for area, name in ((A2K, "2K"), (A1M, "1 MP")):
    print(f"\n{name}: best ceiling per clip length (time vs ceiling 90 / 130 / 190)")
    ceilings = range(40, 600, 1)
    for frames in (124, 175, 241, 300, 361, 480):
        costs = {c: clip_cost(frames, c, area) for c in ceilings}
        best = min(costs, key=costs.get)
        sample = " / ".join(f"{costs[c] / costs[best]:.2f}" for c in (90, 130, 190) if c in costs)
        print(f"  {frames:4d} frames: best {best:4d} (x{best * area:.0f} M px-frames)  relative cost {sample}")
    # one fixed ceiling for all lengths: total time over the lengths, per ceiling in px-frames
    lens = range(73, 600, 17)
    tot = {c: sum(clip_cost(f, c, area) for f in lens) for c in range(40, 600, 3)}
    best = min(tot, key=tot.get)
    print(f"  one ceiling for 73-600 frames: {best} frames = {best * area:.0f} M px-frames; "
          f"90 costs x{tot[min(tot, key=lambda c: abs(c - 90))] / tot[best]:.3f}")
