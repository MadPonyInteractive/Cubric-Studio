"""MPI-1350: where does a single H3 refine pass run out of memory?

usage (one config per lease):
  python gpu_lease.py run --timeout 14400 -- python edge_bench.py <size> <card_gib> <known_pass>
    size      2k (576x1024 -> 1152x2048, 2.36 M px) | 1m (384x672 -> 768x1344, 1.03 M px)
    card_gib  12 = ballast down to a 12 GB card, 16 = the bench as it is
    known_pass  frames already known to pass (search starts above it)

Same harness as capped_bench.py (shipped flow_h3_upscale.json, models loaded between jobs).
Job 0 is auto on a short 1 MP clip: its sampler line gives the usable VRAM auto sees.
Then single passes on the 17k+5 grid: +51 frames until one fails, then bisect to 17.
A failure that is not out-of-memory aborts: a bug is not an edge.
Appends one record per config to edge_results.json.
"""
import json, os, subprocess, sys, time
import capped_bench as cb

IN = "G:/ComfyUi/ComfyUI/input/mpi1350"
CROP = {"2k": "576:1024", "1m": "384:672"}
MAX = 600


def clip(size, n):
    name = f"{size}_{n}.mp4"
    if not os.path.exists(f"{IN}/{name}"):
        subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", f"{IN}/pp_{size}.mp4", "-frames:v", str(n),
                               "-af", f"atrim=end={n / 24:.4f}", "-c:v", "libx264", "-crf", "14",
                               "-pix_fmt", "yuv420p", "-c:a", "aac", f"{IN}/{name}"])
    return name


def is_oom(err):
    e = err.lower()
    return "out of memory" in e or "outofmemory" in e or "allocat" in e


def main():
    size, card, known = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    cb.free_other_engines()
    time.sleep(5)
    base = cb.used_mib()
    print(f"card in use before: {base} MiB")
    if base > 3000:
        sys.exit(f"ABORT: {base} MiB already held by someone else")
    ballast = None
    if card < 16:
        ballast = subprocess.Popen([cb.PY, "-c", cb.BALLAST, str(card * 1024)], stdout=subprocess.PIPE, text=True)
        print(ballast.stdout.readline().strip())
    logpath = os.path.join(cb.HERE, f"edge_{size}_{card}.log")
    log = open(logpath, "w", encoding="utf-8", errors="replace")
    engine = subprocess.Popen([cb.PY, "-s", "ComfyUI/main.py", "--windows-standalone-build", "--port", str(cb.PORT)],
                              cwd=cb.BENCH, stdout=log, stderr=subprocess.STDOUT)
    rec = {"size": size, "card_gib": card, "runs": []}
    try:
        for _ in range(120):
            try:
                cb.get("/system_stats"); break
            except Exception:
                time.sleep(5)
        else:
            sys.exit("ABORT: engine never answered")
        rec["runs"].append(cb.run(f"usable_{card}", clip("1m", 73), "0"))
        lo, hi = known, None
        while True:
            n = lo + 51 if hi is None else lo + ((hi - lo) // 34) * 17
            if n > MAX or (hi is not None and hi - lo <= 17):
                break
            r = cb.run(f"e{size}_{card}_{n}", clip(size, n), "100000")
            rec["runs"].append(r)
            if r["ok"]:
                lo = n
            elif is_oom(r["error"]):
                hi = n
                try:
                    cb.get("/free", {"unload_models": False, "free_memory": True})
                except Exception:
                    pass
            else:
                print("ABORT: not an out-of-memory failure"); break
        rec["largest_pass"], rec["smallest_fail"] = lo, hi
    finally:
        engine.terminate(); engine.wait(60)
        if ballast:
            ballast.terminate(); ballast.wait(60)
        log.close()
        rec["sampler_lines"] = [l.strip() for l in open(logpath, encoding="utf-8", errors="replace")
                                if "[MpiWindowedSampler]" in l and "] window " not in l]
        path = os.path.join(cb.HERE, "edge_results.json")
        allrec = json.load(open(path)) if os.path.exists(path) else []
        allrec.append(rec)
        json.dump(allrec, open(path, "w"), indent=1)
        print(json.dumps({k: rec.get(k) for k in ("size", "card_gib", "largest_pass", "smallest_fail")}))


if __name__ == "__main__":
    main()
