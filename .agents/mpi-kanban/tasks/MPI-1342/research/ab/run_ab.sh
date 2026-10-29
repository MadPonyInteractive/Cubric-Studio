#!/bin/sh
# Runs under gpu_lease.py: GPU scratch engine on 48199 from the G:\ComfyUi bench (MpiNodes is a link
# to the working repo; the three old packs loaded too), then ab.py, then stops the engine.
#   sh run_ab.sh <scratch> [interp,stems,pano]
set -e
HERE="C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1342/research/ab"
S="$1"   # scratch dir: engine temp/out/user, in/ (inputs), before/ (pre-swap graphs)
mkdir -p "$S/temp" "$S/out" "$S/in" "$S/user"
cd "G:/ComfyUi"
PACKS=$(ls ComfyUI/custom_nodes | grep -v -i -E '__pycache__|\.disabled$|\.example$|\.py$')
./python_embeded/python.exe -s ComfyUI/main.py --listen 127.0.0.1 --port 48199 \
  --disable-all-custom-nodes --whitelist-custom-nodes $PACKS \
  --temp-directory "$S/temp" --output-directory "$S/out" --input-directory "$S/in" --user-directory "$S/user" \
  > "$S/engine_gpu.log" 2>&1 &
ENGINE=$!
trap 'kill $ENGINE 2>/dev/null; taskkill //PID $ENGINE //T //F >/dev/null 2>&1 || true' EXIT
curl -s --retry 60 --retry-connrefused --retry-delay 3 -m 300 -o /dev/null http://127.0.0.1:48199/system_stats
./python_embeded/python.exe -s "$HERE/ab.py" "$S/before" "$S/in" $2
