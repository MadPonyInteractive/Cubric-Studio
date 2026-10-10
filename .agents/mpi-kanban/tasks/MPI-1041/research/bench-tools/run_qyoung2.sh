#!/bin/bash
# Batch 21 (qyoung.py KEYS="age0s age0u age1c"): the swaddled newborn (Fabio 2026-10-10) and the toddler with the hair
# clause, on the Flow's own legs - Klein age edit, then the Qwen rebuild. 12 runs.
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age/young
IN=G:/ComfyUi/ComfyUI/input
export KEYS="age0s age0u age1c"
echo "run_qyoung2.sh: start $(date +%H:%M:%S)"
python $B/qyoung.py $OUT klein
python $B/qyoung.py $OUT rebuild
for sh in photo fisher; do
  S=$IN/mpi1042art_cafe2_sheet.png; [ $sh = fisher ] && S=$IN/mpi1042art_fisher_sheet.png
  python $B/pairs.py $OUT/pairs_swaddle_$sh.jpg $S $OUT/young_age0s_$sh.png $OUT/rebuild_age0s_$sh.png $OUT/young_age0u_$sh.png $OUT/rebuild_age0u_$sh.png
  python $B/pairs.py $OUT/pairs_age1c_$sh.jpg $S $OUT/young_age1c_$sh.png $OUT/rebuild_age1c_$sh.png
done
echo "run_qyoung2.sh: done $(date +%H:%M:%S)"
