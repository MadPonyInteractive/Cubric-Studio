#!/usr/bin/env bash
# MPI-1148: start the G: bench ComfyUI, run a spec through MPI-1042's run_api.py, stop ComfyUI.
# Run under the lease:  python <mpi-lib>/scripts/gpu_lease.py run -- bash bench.sh <spec.json> <outdir>
set -u
SPEC="$1"; OUT="$2"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd /g/ComfyUi
./python_embeded/python.exe -s ComfyUI/main.py --windows-standalone-build --port 8188 > "$OUT/comfy.log" 2>&1 &
PID=$!
for i in $(seq 1 120); do
  curl -s -m 2 http://127.0.0.1:8188/system_stats > /dev/null && break
  sleep 2
done
python "$HERE/../../MPI-1042/research/bench-tools/run_api.py" "$OUT" "$SPEC"
RC=$?
kill $PID 2>/dev/null; sleep 2; taskkill //F //PID $PID > /dev/null 2>&1
exit $RC
