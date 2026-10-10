#!/bin/bash
# Batch 20 (qyoung.py): newborn (0) and toddler (1) on the Flow's own legs - Klein age edit, then the Qwen rebuild. 16 runs.
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age/young
IN=G:/ComfyUi/ComfyUI/input
echo "run_qyoung.sh: start $(date +%H:%M:%S)"
python $B/qyoung.py $OUT klein
python $B/qyoung.py $OUT rebuild
for sh in photo fisher; do
  S=$IN/mpi1042art_cafe2_sheet.png; [ $sh = fisher ] && S=$IN/mpi1042art_fisher_sheet.png
  for a in age0 age1; do
    python $B/pairs.py $OUT/pairs_${a}_$sh.jpg $S $OUT/young_${a}a_$sh.png $OUT/rebuild_${a}a_$sh.png $OUT/young_${a}b_$sh.png $OUT/rebuild_${a}b_$sh.png
  done
done
echo "run_qyoung.sh: done $(date +%H:%M:%S)"
