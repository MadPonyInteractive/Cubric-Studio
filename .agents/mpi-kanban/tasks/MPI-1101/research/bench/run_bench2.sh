#!/bin/bash
# MPI-1101 bench ROUND 2: the repaint at real strength (bench.py VARIANTS: Klein 0.75 + 1.0, Krea 1.0, seed 42).
# Round 1 (run_bench.sh, output/mpi1101) ran the graphs' baked masked-branch denoise (Klein 0.4, Krea 0.3) and
# redrew the seams. Reuses round 1's two t2i textures. Needs the G:\ComfyUi bench on :8188. Run ONLY under the lease:
#   python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py run --timeout 21600 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" .agents/mpi-kanban/tasks/MPI-1101/research/bench/run_bench2.sh
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1101/research/bench
RUN=.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py
OUT=G:/ComfyUi/ComfyUI/output/mpi1101b
echo "run_bench2.sh: start $(date +%H:%M:%S)"
mkdir -p $OUT && cp G:/ComfyUi/ComfyUI/output/mpi1101/t2i_*.png $OUT/ || exit 1
python $B/bench.py prep $OUT || exit 1
python $B/bench.py spec $OUT || exit 1
python $RUN $OUT $OUT/spec.json || echo "SOME REPAINTS FAILED"
python $B/bench.py post $OUT
echo "run_bench2.sh: done $(date +%H:%M:%S)"
