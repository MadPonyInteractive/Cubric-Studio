"""Run bench windows in order, stop at the first failure. usage: python run_chain.py B:1 B:2 A:0 [quality]"""
import subprocess, sys
for job in sys.argv[1:]:
    arm, w, *q = job.split(":")
    r = subprocess.run([sys.executable, "bench.py", arm, w] + q)
    if r.returncode:
        sys.exit(r.returncode)
