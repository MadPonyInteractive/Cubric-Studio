#!/bin/bash
# Batch 19, portrait first then the bodies by reference (qp2b.py), 5 Klein runs on :8188. PHASE=2 = the child re-runs
# + muscular fisher. Lease only:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age
IN=G:/ComfyUi/ComfyUI/input
PH=$IN/mpi1042art_cafe2_sheet.png
FI=$IN/mpi1042art_fisher_sheet.png
python $B/qp2b.py $OUT ${PHASE:-1}
if [ "${PHASE:-1}" = 4 ]; then
  python $B/width.py $FI $OUT/p2b_muscle3_fisher.png
  python $B/width.py $PH $OUT/p2b_skinny2_photo.png
  python $B/pairs.py $OUT/pairs_p2b_body4.jpg $FI $OUT/p2b_muscle3_fisher.png
  python $B/pairs.py $OUT/pairs_p2b_body5.jpg $PH $OUT/p2b_skinny2_photo.png $OUT/p2b_heavy_photo.png
  exit 0
fi
if [ "${PHASE:-1}" = 3 ]; then
  python $B/width.py $FI $OUT/p2b_muscle2_fisher.png
  python $B/width.py $PH $OUT/p2b_skinny_photo.png
  python $B/pairs.py $OUT/pairs_p2b_body2.jpg $FI $OUT/p2b_muscle2_fisher.png
  python $B/pairs.py $OUT/pairs_p2b_body3.jpg $PH $OUT/p2b_skinny_photo.png $OUT/p2b_child2_photo.png
  exit 0
fi
python $B/layout.py $PH $OUT/ref_child_photo.png $OUT/p2b_child_photo.png
python $B/layout.py $FI $OUT/p2b_child_fisher.png
python $B/pairs.py $OUT/pairs_p2b_child_photo.jpg $PH $OUT/ref_child_photo.png $OUT/p2b_child_photo.png
python $B/pairs.py $OUT/pairs_p2b_child_fisher.jpg $FI $OUT/p2b_child_fisher.png
if [ "${PHASE:-1}" = 2 ]; then
  python $B/layout.py $FI $OUT/p2b_muscle_fisher.png
  python $B/width.py $FI $OUT/p2b_muscle_fisher.png
  python $B/pairs.py $OUT/pairs_p2b_muscle_fisher.jpg $FI $OUT/p2b_muscle_fisher.png
else
  python $B/layout.py $PH $OUT/p2b_heavy_photo.png
  python $B/width.py $PH $OUT/p2b_heavy_photo.png
  python $B/pairs.py $OUT/pairs_p2b_heavy_photo.jpg $PH $OUT/p2b_heavy_photo.png
fi
