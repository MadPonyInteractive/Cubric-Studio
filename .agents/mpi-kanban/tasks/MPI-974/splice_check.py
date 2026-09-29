"""Replay flow_h3_extend's audio chain (#950 #942 #951 #907 #952) with the REAL MpiNodes
code on synthetic audio, for every Seconds-to-add x Context x source length.
OLD start (#953 = (context-24) - L, from the END) vs NEW start (source frames - 24)."""
import sys, types, importlib.util, os
import torch, torchaudio

PKG = r"C:\AI\Mpi\ComfyUi-MpiNodes"
sys.modules["folder_paths"] = types.ModuleType("folder_paths")
pkg = types.ModuleType("mpinodes"); pkg.__path__ = [PKG]; sys.modules["mpinodes"] = pkg
def load(name):
    spec = importlib.util.spec_from_file_location(f"mpinodes.{name}", os.path.join(PKG, f"{name}.py"))
    m = importlib.util.module_from_spec(spec); sys.modules[spec.name] = m; spec.loader.exec_module(m); return m
h3 = load("h3"); video = load("video")
Range, Splice = video.MpiAudioRange(), video.MpiAudioSplice()

H3_RATE, FPS = 32000, 24
def concat(a1, a2):  # core AudioConcat(direction=after) incl. match_audio_sample_rates
    w1, r1, w2, r2 = a1["waveform"], a1["sample_rate"], a2["waveform"], a2["sample_rate"]
    if r1 > r2: w2, r = torchaudio.functional.resample(w2, r2, r1), r1
    elif r2 > r1: w1, r = torchaudio.functional.resample(w1, r1, r2), r2
    else: r = r1
    return {"waveform": torch.cat([w1, w2], -1), "sample_rate": r}

def run(d, ctx, F, src_rate, new):
    L = h3.MpiH3Length().doit(round(d) + ctx / 24)[0]           # #214 -> #954 -> #213
    G = round(L / FPS * 40) * 800                              # core temporal_shape audio_t, 800 samples/step
    src = {"waveform": torch.randn(1, 2, round((F + 3) * src_rate / FPS)), "sample_rate": src_rate}
    gen = {"waveform": torch.randn(1, 2, G), "sample_rate": H3_RATE}
    a950 = Range.doit(src, FPS, 0, F - 1)[0]
    a942 = Range.doit(gen, FPS, ctx, -1)[0]
    a951 = Range.doit(gen, FPS, ctx - 24, -1)[0]
    a907 = concat(a950, a942)
    start = (F - 24) if new else (ctx - 24) - L
    try:
        out = Splice.doit(a907, a951, FPS, start, 800)[0]
    except ValueError as e:
        return L, "RAISE", str(e)[:60]
    # Where did the patch land vs where the join puts gen frame ctx-24? (samples at track rate)
    r = a907["sample_rate"]
    want = a950["waveform"].shape[-1] + round((ctx - 24 - ctx) * r / FPS)
    got = video._frame_sample(start, FPS, r, a907["waveform"].shape[-1], start < 0)
    return L, "ok", got - want

bad = 0
for new in (False, True):
    rows = []
    for src_rate in (32000, 44100):
        for ctx in (39, 90, 141):
            for F in (90, 97, 124, 226):
                for d in range(1, 11):
                    L, st, x = run(d, ctx, F, src_rate, new)
                    if st == "RAISE" or abs(x) > 2:
                        rows.append((src_rate, ctx, F, d, L, st, x))
    print(("NEW" if new else "OLD"), "failures/misplacements:", len(rows))
    for row in rows[:8]: print("  ", row)
    if new: bad = len(rows)
assert bad == 0, "new start still fails"
print("NEW start: every combo splices, patch lands within 2 samples of the join")
