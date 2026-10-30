"""MPI-1350: where does a bigger H3 refine window stop paying? Two steps per size, then cancel.

usage (one config per lease):
  python gpu_lease.py run --timeout 14400 -- python speed_probe.py <size> <card_gib> <frames> [<frames> ...]
    size 2k | 1m (see edge_bench.py), card_gib 12 (ballast) | 16, frames ascending on the 17k+5 grid

Each size runs as a single pass (Window Frames "100000") and is interrupted once its SECOND
step is done; step 2 is the clean time (step 1 carries model init). Stops a config at the first
size whose step 1 alone passes STOP_S (past the cliff: a full step 2 would cost minutes for
nothing). Job 0 = auto on a short clip, for the usable VRAM auto sees. Appends to
speed_results.json.
"""
import json, os, re, subprocess, sys, time, urllib.request
import capped_bench as cb
from edge_bench import clip

STOP_S = 450
TICK = re.compile(r"([123])/3 \[(\d+):(\d+)")


def step_times(text):
    """Elapsed seconds when step 1 and step 2 finished, from the LAST run's tqdm in `text`."""
    seen = {}
    for m in TICK.finditer(text):
        k = int(m.group(1))
        seen.setdefault(k, int(m.group(2)) * 60 + int(m.group(3)))
    return seen


def probe(logpath, size, card, n):
    g = json.load(open(cb.GRAPH, encoding="utf-8"))
    g["1"]["inputs"]["string"] = f"mpi1350/{clip(size, n)}"
    g["23"]["inputs"]["string"] = cb.PROMPT
    g["36"]["inputs"]["math_expression"] = "100000"
    g["40"]["inputs"]["filename_prefix"] = f"mpi1350/speed_{size}_{card}_{n}"
    start = os.path.getsize(logpath)
    t0 = time.time()
    pid = cb.get("/prompt", {"prompt": g})["prompt_id"]
    peak = 0
    while True:
        time.sleep(5)
        peak = max(peak, cb.used_mib())
        with open(logpath, encoding="utf-8", errors="replace") as f:
            f.seek(start)
            s = step_times(f.read())
        h = cb.get(f"/history/{pid}")
        ended = pid in h
        past = 1 in s and s[1] > STOP_S
        if 2 in s or past or ended or time.time() - t0 > 3 * 3600:
            break
        if 1 not in s and time.time() - t0 > STOP_S + 600:  # init + step 1 never came
            past = True
            break
    if not ended:  # /interrupt answers with an empty body, not JSON
        urllib.request.urlopen(urllib.request.Request(cb.URL + "/interrupt", b"{}",
                                                      {"Content-Type": "application/json"}), timeout=30).read()
        while pid not in cb.get(f"/history/{pid}"):
            time.sleep(3)
    err = [m[1].get("exception_message", "")[:300]
           for m in cb.get(f"/history/{pid}")[pid]["status"].get("messages", []) if m[0] == "execution_error"]
    r = {"size": size, "card_gib": card, "frames": n, "step1_s": s.get(1),
         "step2_s": s[2] - s[1] if 2 in s else None, "past_cliff": past, "peak_used_mib": peak,
         "error": err[0] if err else ""}
    print(json.dumps(r), flush=True)
    urllib.request.urlopen(urllib.request.Request(cb.URL + "/free", b'{"free_memory":true}',
                                                  {"Content-Type": "application/json"}), timeout=30).read()
    return r


def main():
    size, card, sizes = sys.argv[1], int(sys.argv[2]), [int(x) for x in sys.argv[3:]]
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
    logpath = os.path.join(cb.HERE, f"speed_{size}_{card}.log")
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
        rec["usable"] = cb.run(f"usable_{size}_{card}", clip("1m", 73), "0")
        for n in sizes:
            r = probe(logpath, size, card, n)
            rec["runs"].append(r)
            if r["past_cliff"] or r["error"] and "interrupt" not in r["error"].lower():
                break
    finally:
        engine.terminate(); engine.wait(60)
        if ballast:
            ballast.terminate(); ballast.wait(60)
        log.close()
        rec["sampler_lines"] = [l.strip() for l in open(logpath, encoding="utf-8", errors="replace")
                                if "[MpiWindowedSampler]" in l and "auto:" in l]
        path = os.path.join(cb.HERE, "speed_results.json")
        allrec = json.load(open(path)) if os.path.exists(path) else []
        allrec.append(rec)
        json.dump(allrec, open(path, "w"), indent=1)


if __name__ == "__main__":
    main()
