#!/bin/bash
# MPI-1101 bench ROUND 3: Klein with the band blanked out of the input first (bench.py VARIANTS: none / blur / flat).
# Rounds 1-2 showed the masked branch reproduces its own edit reference, seam included. Reuses round 1's t2i textures.
# Needs the G:\ComfyUi bench on :8188. Run ONLY under the lease:
#   python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py run --timeout 21600 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" .agents/mpi-kanban/tasks/MPI-1101/research/bench/run_bench3.sh
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1101/research/bench
RUN=.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py
OUT=G:/ComfyUi/ComfyUI/output/mpi1101c
echo "run_bench3.sh: start $(date +%H:%M:%S)"
mkdir -p $OUT && cp G:/ComfyUi/ComfyUI/output/mpi1101/t2i_*.png $OUT/ || exit 1
python $B/bench.py prep $OUT || exit 1
python $B/bench.py spec $OUT || exit 1
python $RUN $OUT $OUT/spec.json || echo "SOME REPAINTS FAILED"
python $B/bench.py post $OUT
echo "run_bench3.sh: done $(date +%H:%M:%S)"
