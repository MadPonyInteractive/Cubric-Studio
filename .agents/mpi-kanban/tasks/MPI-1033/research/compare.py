"""Compare an output clip's soundtrack with the source's. usage: python compare.py <source> <output>"""
import subprocess, sys
import numpy as np
from scipy import signal

SR = 16000


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


src, out = load(sys.argv[1]), load(sys.argv[2])
n = min(len(src), len(out))
src, out = src[:n], out[:n]

# waveform cross-correlation, lag within +-200 ms
max_lag = SR // 5
xc = signal.correlate(out, src, mode="full")[n - 1 - max_lag:n + max_lag]
xc /= np.sqrt((src ** 2).sum() * (out ** 2).sum())
lag = int(np.argmax(np.abs(xc))) - max_lag


def env(a, hop=320):
    return np.array([np.sqrt((a[i:i + hop] ** 2).mean()) for i in range(0, len(a) - hop, hop)])


def logspec(a):
    _, _, s = signal.spectrogram(a, SR, nperseg=512, noverlap=352)
    return np.log10(s + 1e-9)


e_corr = np.corrcoef(env(src), env(out))[0, 1]
s1, s2 = logspec(src), logspec(out)
s_corr = np.corrcoef(s1.ravel(), s2.ravel())[0, 1]
print(f"seconds compared {n / SR:.2f}")
print(f"waveform xcorr peak {np.max(np.abs(xc)):.3f} at lag {lag / SR * 1000:.1f} ms")
print(f"loudness-envelope corr {e_corr:.3f}")
print(f"log-spectrogram corr {s_corr:.3f}")
print(f"rms src {np.sqrt((src ** 2).mean()):.3f} out {np.sqrt((out ** 2).mean()):.3f}")
