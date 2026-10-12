#!/bin/bash
# MPI-1101 bench: Klein 9B vs Krea 2 repainting a seam band (see bench.py). 2 t2i + 16 repaints on :8188, then CPU post.
# Needs the G:\ComfyUi bench running on :8188. Run ONLY under the lease, and only when Fabio says the GPU is free:
#   python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py run --timeout 5400 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" .agents/mpi-kanban/tasks/MPI-1101/research/bench/run_bench.sh
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1101/research/bench
RUN=.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py
OUT=G:/ComfyUi/ComfyUI/output/mpi1101
echo "run_bench.sh: start $(date +%H:%M:%S)"
python $B/bench.py t2i $OUT || exit 1
python $RUN $OUT $OUT/t2i_spec.json || { echo "T2I FAILED"; exit 1; }
python $B/bench.py prep $OUT || exit 1
python $B/bench.py spec $OUT || exit 1
python $RUN $OUT $OUT/spec.json || echo "SOME REPAINTS FAILED"
python $B/bench.py post $OUT
echo "run_bench.sh: done $(date +%H:%M:%S)"
