"""Assemble a chain and measure its seams. usage: python seams.py <arm> [quality]"""
import subprocess, sys
import numpy as np

IN = "G:/ComfyUi/ComfyUI/input/mpi1336"
SRC = "C:/Users/Fabio/Documents/Cubric Studio/Projects/Video edit showcase/Media/ref2v_003.mp4"
arm = sys.argv[1]
q = sys.argv[2] if len(sys.argv) > 2 else "1032192"
W, H, CTX, ADV = 192, 336, 39, 85

def frames(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)

wins = [frames(f"{IN}/{arm}_q{q}_w{i}.mp4") for i in range(3)]
print("window frame counts", [len(x) for x in wins])
out = np.concatenate([wins[0]] + [x[CTX:] for x in wins[1:]])
src = frames(SRC)[:len(out)]
seams = [len(wins[0]) + ADV * i for i in range(len(wins) - 1)]

def diffs(v):
    return np.abs(np.diff(v, axis=0)).mean(axis=(1, 2, 3))
d, ds = diffs(out), diffs(src)
ratio = d / np.maximum(ds, 0.5)
print(f"assembled {len(out)} frames; frame-to-frame diff median {np.median(d):.2f} p95 {np.percentile(d, 95):.2f} max {d.max():.2f} at {d.argmax()+1}")
for s in seams:
    print(f"seam at frame {s}: out diff {d[s-1]:.2f} (source {ds[s-1]:.2f}), ratio {ratio[s-1]:.2f} vs median ratio {np.median(ratio):.2f}, p99 {np.percentile(ratio, 99):.2f}")
for i in range(1, len(wins)):
    head = np.abs(wins[i][:CTX] - wins[i - 1][ADV:ADV + CTX]).mean()
    print(f"w{i} preserved head vs w{i-1} tail: mean abs diff {head:.2f} (0-255)")
m0, m2 = wins[0].mean(axis=(0, 1, 2)), wins[-1].mean(axis=(0, 1, 2))
s0, s2 = src[:124].mean(axis=(0, 1, 2)), src[-124:].mean(axis=(0, 1, 2))
print("mean RGB first window", m0.round(1), "last", m2.round(1), "| source first", s0.round(1), "last", s2.round(1))

# write the assembled clip with the untouched source audio over the same span
raw = out.astype(np.uint8)
full = subprocess.check_output(["ffmpeg", "-v", "error", "-i", f"{IN}/{arm}_q{q}_w0.mp4", "-f", "null", "-"])  # probe only
cmd = ["ffmpeg", "-v", "error", "-y"]
parts = [f"{IN}/{arm}_q{q}_w{i}.mp4" for i in range(3)]
for p in parts:
    cmd += ["-i", p]
cmd += ["-i", SRC, "-filter_complex",
        f"[0:v]trim=start_frame=0:end_frame=124,setpts=PTS-STARTPTS[a];"
        f"[1:v]trim=start_frame={CTX}:end_frame=124,setpts=PTS-STARTPTS[b];"
        f"[2:v]trim=start_frame={CTX}:end_frame=124,setpts=PTS-STARTPTS[c];"
        f"[a][b][c]concat=n=3:v=1:a=0[v];[3:a]atrim=duration={len(out)/24},asetpts=N/SR/TB[au]",
        "-map", "[v]", "-map", "[au]", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac",
        f"{IN}/chain_{arm}_q{q}.mp4"]
subprocess.check_call(cmd)
print("wrote", f"{IN}/chain_{arm}_q{q}.mp4")
