"""Start the G:\\ComfyUi bench on 8189, run bridge.py, measure, stop the bench.
usage (under the lease): python gpu_lease.py run --timeout 7200 -- python run_bridge.py r1 r2 b0 b1"""
import subprocess, sys, time, urllib.request

srv = subprocess.Popen(["G:/ComfyUi/python_embeded/python.exe", "-s", "ComfyUI/main.py",
                        "--windows-standalone-build", "--port", "8189"], cwd="G:/ComfyUi",
                       stdout=open("bench_8189.log", "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(120):
        try:
            urllib.request.urlopen("http://127.0.0.1:8189/queue", timeout=3)
            break
        except Exception:
            time.sleep(5)
    else:
        sys.exit("bench server never answered on 8189")
    print("bench up", flush=True)
    rc = subprocess.run([sys.executable, "bridge.py"] + sys.argv[1:]).returncode
    if rc == 0 and {"b0", "b1"} <= set(sys.argv[1:]):
        rc = subprocess.run([sys.executable, "bridge_seams.py"]).returncode
    elif rc == 0:
        rc = subprocess.run([sys.executable, "cuts.py"] + [f"br_{t}.mp4" for t in sys.argv[1:]]).returncode
    sys.exit(rc)
finally:
    srv.terminate()
