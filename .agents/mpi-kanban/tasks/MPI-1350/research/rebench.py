"""MPI-1350: new auto against the old ceiling, full runs, same clip.

usage: python gpu_lease.py run --timeout 14400 -- python rebench.py <card_gib> <old_ceiling>
2K (576x1024 -> 1152x2048), 294 frames, shipped flow_h3_upscale.json. Job A: Window Frames
= <old_ceiling> (what auto picked before: 64 on 12 GB, 90 on 16 GB). Job B: "0" (new auto).
Appends to rebench_results.json; outputs land in output/mpi1350/rb_<card>_<tag>.
"""
import json, os, subprocess, sys, time
import capped_bench as cb
from edge_bench import clip


def main():
    card, old = int(sys.argv[1]), sys.argv[2]
    cb.free_other_engines()
    time.sleep(5)
    base = cb.used_mib()
    if base > 3000:
        sys.exit(f"ABORT: {base} MiB already held by someone else")
    ballast = None
    if card < 16:
        ballast = subprocess.Popen([cb.PY, "-c", cb.BALLAST, str(card * 1024)], stdout=subprocess.PIPE, text=True)
        print(ballast.stdout.readline().strip())
    logpath = os.path.join(cb.HERE, f"rebench_{card}.log")
    log = open(logpath, "w", encoding="utf-8", errors="replace")
    engine = subprocess.Popen([cb.PY, "-s", "ComfyUI/main.py", "--windows-standalone-build", "--port", str(cb.PORT)],
                              cwd=cb.BENCH, stdout=log, stderr=subprocess.STDOUT)
    rec = {"card_gib": card, "runs": []}
    try:
        for _ in range(120):
            try:
                cb.get("/system_stats"); break
            except Exception:
                time.sleep(5)
        else:
            sys.exit("ABORT: engine never answered")
        src = clip("2k", 294)
        rec["runs"].append(cb.run(f"rb_{card}_old{old}", src, old))
        rec["runs"].append(cb.run(f"rb_{card}_new", src, "0"))
    finally:
        engine.terminate(); engine.wait(60)
        if ballast:
            ballast.terminate(); ballast.wait(60)
        log.close()
        rec["sampler_lines"] = [l.strip()[:400] for l in open(logpath, encoding="utf-8", errors="replace")
                                if "[MpiWindowedSampler]" in l and "] window " not in l]
        path = os.path.join(cb.HERE, "rebench_results.json")
        allrec = json.load(open(path)) if os.path.exists(path) else []
        allrec.append(rec)
        json.dump(allrec, open(path, "w"), indent=1)
        print("\n".join(rec["sampler_lines"]))


if __name__ == "__main__":
    main()
