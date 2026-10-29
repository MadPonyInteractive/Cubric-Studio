"""Assemble roots + bridges (bridge.py) and measure joins + drift against bench 2's 6-window chain,
both measured the SAME way here. usage: python bridge_seams.py"""
import subprocess
import numpy as np

IN = "G:/ComfyUi/ComfyUI/input/mpi1336"
W, H, CTX, ROOT, BR = 192, 336, 39, 124, 192
# (file, first frame kept, end frame) in story order
PARTS = [(f"{IN}/inf_A_w0.mp4", 0, ROOT), (f"{IN}/br_b0.mp4", CTX, BR - CTX), (f"{IN}/br_r1.mp4", 0, ROOT),
         (f"{IN}/br_b1.mp4", CTX, BR - CTX), (f"{IN}/br_r2.mp4", 0, ROOT)]
NAMES = ["r0", "b0", "r1", "b1", "r2"]


def frames(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)


def look(x):
    """Backdrop = the two top corners (above and beside the head), plus whole-frame numbers."""
    c = np.concatenate([x[:, :H // 6, :W // 5], x[:, :H // 6, -W // 5:]], axis=2)
    cm, m = c.mean(axis=(0, 1, 2)), x.mean(axis=(0, 1, 2))
    # speckle: high-frequency energy in the backdrop corners (the window-6 texture in bench 2)
    hf = np.abs(np.diff(c.mean(axis=3), axis=2)).mean()
    return (f"backdrop luma {cm @ [.299, .587, .114]:5.1f} R-B {cm[0] - cm[2]:4.1f} speckle {hf:4.2f} | "
            f"frame luma {m @ [.299, .587, .114]:5.1f} contrast {x.std():4.1f}")


clips = {n: frames(p) for n, (p, _, _) in zip(NAMES, PARTS)}
print("frame counts", {n: len(c) for n, c in clips.items()})
kept = [clips[n][a:b] for n, (_, a, b) in zip(NAMES, PARTS)]
out = np.concatenate(kept)
d = np.abs(np.diff(out, axis=0)).mean(axis=(1, 2, 3))
print(f"assembled {len(out)} frames ({len(out) / 24:.1f} s); frame diff median {np.median(d):.2f} "
      f"p95 {np.percentile(d, 95):.2f} max {d.max():.2f} at {d.argmax() + 1}")
s = 0
for i in range(len(kept) - 1):
    s += len(kept[i])
    print(f"join {NAMES[i]}->{NAMES[i + 1]} at frame {s}: diff {d[s - 1]:.2f}")
for b, (lo, hi) in (("b0", ("r0", "r1")), ("b1", ("r1", "r2"))):
    head = np.abs(clips[b][:CTX] - clips[lo][ROOT - CTX:ROOT]).mean()
    tail = np.abs(clips[b][BR - CTX:] - clips[hi][:CTX]).mean()
    print(f"{b}: held head vs {lo} tail {head:.2f}, held tail vs {hi} head {tail:.2f} (0-255)")

print("\nBRIDGED, per kept segment")
for n, k in zip(NAMES, kept):
    print(f"  {n}: {look(k)}")
print("CHAIN (bench 2, chain_inf_A.mp4), per window's new frames")
chain = frames(f"{IN}/chain_inf_A.mp4")
for i in range(6):
    a = 0 if i == 0 else ROOT + 85 * (i - 1)
    print(f"  w{i}: {look(chain[a:ROOT + 85 * i])}")

cmd = ["ffmpeg", "-v", "error", "-y"]
for p, _, _ in PARTS:
    cmd += ["-i", p]
fc = ""
for i, (_, a, b) in enumerate(PARTS):
    fc += (f"[{i}:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS[v{i}];"
           f"[{i}:a]atrim=start={a / 24}:end={b / 24},asetpts=N/SR/TB[a{i}];")
fc += "".join(f"[v{i}][a{i}]" for i in range(len(PARTS))) + f"concat=n={len(PARTS)}:v=1:a=1[v][a]"
cmd += ["-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "16",
        "-pix_fmt", "yuv420p", "-c:a", "aac", f"{IN}/bridged_inf.mp4"]
subprocess.check_call(cmd)
print("wrote", f"{IN}/bridged_inf.mp4")
