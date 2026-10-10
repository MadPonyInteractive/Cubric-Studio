#!/bin/bash
# Age by exact target age (qage.py), 5 edits per editor on :8188, clothed sheets only. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file> <klein|qwen21|boogu>...
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age
IN=G:/ComfyUi/ComfyUI/input
# prompt set from the env: SET=v2 (batch 13); unset = batch 11's set
for M in "$@"; do
  T=$M$SET
  python $B/qage.py $M $OUT $SET
  python $B/layout.py $IN/mpi1042art_cafe2_sheet.png $OUT/${T}_*_photo.png
  python $B/layout.py $IN/mpi1042art_fisher_sheet.png $OUT/${T}_*_fisher.png
  python $B/width.py $IN/mpi1042art_cafe2_sheet.png $OUT/${T}_*_photo.png
  python $B/width.py $IN/mpi1042art_fisher_sheet.png $OUT/${T}_*_fisher.png
  python $B/height.py $IN/mpi1042art_cafe2_sheet.png $OUT/${T}_*_photo.png
  python $B/height.py $IN/mpi1042art_fisher_sheet.png $OUT/${T}_*_fisher.png
  python $B/pairs.py $OUT/pairs_age_${T}_photo.jpg $IN/mpi1042art_cafe2_sheet.png $OUT/${T}_*_photo.png
  python $B/pairs.py $OUT/pairs_age_${T}_fisher.jpg $IN/mpi1042art_fisher_sheet.png $OUT/${T}_*_fisher.png
done
