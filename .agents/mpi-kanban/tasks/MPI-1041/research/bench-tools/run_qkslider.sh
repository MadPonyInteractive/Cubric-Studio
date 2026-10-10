#!/bin/bash
# Krea 2 Turbo + Loraholic's age slider, 4 edits (qba.py krea2s) on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_qba
IN=G:/ComfyUi/ComfyUI/input
python $B/qba.py krea2s $OUT
python $B/layout.py $IN/mpi1042art_cafe2_sheet.png $OUT/krea2s_*_photo.png
python $B/layout.py $IN/mpi1042art_fisher_sheet.png $OUT/krea2s_*_fisher.png
python $B/width.py $IN/mpi1042art_cafe2_sheet.png $OUT/krea2s_*_photo.png
python $B/width.py $IN/mpi1042art_fisher_sheet.png $OUT/krea2s_*_fisher.png
python $B/pairs.py $OUT/pairs_krea2s_photo.jpg $IN/mpi1042art_cafe2_sheet.png $OUT/krea2s_*_photo.png
python $B/pairs.py $OUT/pairs_krea2s_fisher.jpg $IN/mpi1042art_fisher_sheet.png $OUT/krea2s_*_fisher.png
