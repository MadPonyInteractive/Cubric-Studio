"""Assemble the Infinite Video chain and measure seams + drift. usage: python infinite_seams.py [windows]"""
import subprocess, sys
import numpy as np

IN = "G:/ComfyUi/ComfyUI/input/mpi1336"
n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
W, H, CTX, ADV = 192, 336, 39, 85
parts = [f"{IN}/inf_A_w{i}.mp4" for i in range(n)]


def frames(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)


wins = [frames(p) for p in parts]
print("window frame counts", [len(x) for x in wins])
out = np.concatenate([wins[0]] + [x[CTX:] for x in wins[1:]])
d = np.abs(np.diff(out, axis=0)).mean(axis=(1, 2, 3))
print(f"assembled {len(out)} frames; frame-to-frame diff median {np.median(d):.2f} p95 {np.percentile(d, 95):.2f} "
      f"p99 {np.percentile(d, 99):.2f} max {d.max():.2f} at {d.argmax() + 1}")
for i in range(1, n):
    s = len(wins[0]) + ADV * (i - 1)
    head = np.abs(wins[i][:CTX] - wins[i - 1][ADV:ADV + CTX]).mean()
    print(f"seam {i} at frame {s}: diff {d[s - 1]:.2f}; w{i} preserved head vs w{i-1} tail {head:.2f} (0-255)")

# drift: whole frame, and the grey backdrop alone (top band, above the head)
bg = (slice(0, H // 8), slice(None))
for i, x in enumerate(wins):
    new = x if i == 0 else x[CTX:]
    m, b = new.mean(axis=(0, 1, 2)), new[:, bg[0], bg[1]].mean(axis=(0, 1, 2))
    sat = (new.max(axis=3) - new.min(axis=3)).mean()
    print(f"w{i} new frames: mean RGB {m.round(1)} luma {m @ [.299, .587, .114]:.1f} | backdrop RGB {b.round(1)} | "
          f"saturation {sat:.1f} | contrast (std) {new.std():.1f}")

cmd = ["ffmpeg", "-v", "error", "-y"]
for p in parts:
    cmd += ["-i", p]
fc = ""
for i in range(n):
    start = 0 if i == 0 else CTX
    fc += (f"[{i}:v]trim=start_frame={start}:end_frame=124,setpts=PTS-STARTPTS[v{i}];"
           f"[{i}:a]atrim=start={start / 24}:end={124 / 24},asetpts=N/SR/TB[a{i}];")
fc += "".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]"
cmd += ["-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "16",
        "-pix_fmt", "yuv420p", "-c:a", "aac", f"{IN}/chain_inf_A.mp4"]
subprocess.check_call(cmd)
print("wrote", f"{IN}/chain_inf_A.mp4")
