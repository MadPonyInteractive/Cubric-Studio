# MPI-1335 step 2b: does the output's mouth follow the source's? Per frame, mouth opening (MediaPipe FaceMesh
# inner-lip gap / mouth width) for the source and each output, then:
#   corr@0   correlation of the two opening curves with no shift (1 = the mouth moves with the source)
#   best lag the shift (frames) with the highest correlation; negative = the output's mouth runs late
#   quiet    mean opening on frames where the SOURCE is silent, output vs source (speech in the pauses)
# Needs mediapipe (a scratch venv). Usage: python mouth.py SOURCE.mp4 OUT1.mp4 [OUT2.mp4 ...]
import subprocess, sys
import cv2
import mediapipe as mp
import numpy as np

FPS = 24


def opening(path):
    cap, vals = cv2.VideoCapture(path), []
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=True) as fm:
        while True:
            ok, img = cap.read()
            if not ok:
                break
            res = fm.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            if not res.multi_face_landmarks:
                vals.append(np.nan)
                continue
            p = res.multi_face_landmarks[0].landmark
            d = lambda a, b: np.hypot(p[a].x - p[b].x, p[a].y - p[b].y)
            vals.append(d(13, 14) / max(d(78, 308), 1e-6))
    return np.array(vals)


def loudness(path, n):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '48000', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(float)
    per = 48000 // FPS
    rms = np.array([np.sqrt(np.mean(a[i * per:(i + 1) * per] ** 2)) if (i + 1) * per <= len(a) else 0 for i in range(n)])
    return rms


def corr(x, y):
    m = ~(np.isnan(x) | np.isnan(y))
    return np.corrcoef(x[m], y[m])[0, 1] if m.sum() > 10 else np.nan


src = opening(sys.argv[1])
rms = loudness(sys.argv[1], len(src))
quiet = rms < 0.15 * np.nanmax(rms)
print(f'source: {len(src)} frames, face found on {np.isfinite(src).sum()}, quiet frames {quiet.sum()}, '
      f'opening quiet {np.nanmean(src[quiet]):.3f} / speaking {np.nanmean(src[~quiet]):.3f}')
for out in sys.argv[2:]:
    o = opening(out)
    n = min(len(o), len(src))
    s, o2, q = src[:n], o[:n], quiet[:n]
    lags = {k: corr(s[max(0, -k):n - max(0, k)], o2[max(0, k):n - max(0, -k)]) for k in range(-12, 13)}
    best = max(lags, key=lambda k: -1 if np.isnan(lags[k]) else lags[k])
    print(f'{out.split("/")[-1]:32s} frames {len(o)} face {np.isfinite(o).sum()}  corr@0 {lags[0]:.2f}  '
          f'best lag {-best:+d} (corr {lags[best]:.2f})  quiet {np.nanmean(o2[q]):.3f} vs speaking {np.nanmean(o2[~q]):.3f}')
