#!/bin/bash
# Bench Q3 round 2 on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_q3r2
IN=G:/ComfyUi/ComfyUI/input
python $B/q3r2.py $OUT
python $B/contact.py $OUT $OUT/contact_A.jpg "A_*.png" 2
python $B/contact.py $OUT $OUT/contact_B.jpg "B_*.png" 2
python $B/layout.py $IN/mpi1041_nude_sheet.png $OUT/[AB]_*_nude.png
python $B/layout.py $IN/mpi1042art_cafe2_sheet.png $OUT/[AB]_*_photo.png
python $B/layout.py $IN/mpi1042art_fisher_sheet.png $OUT/[AB]_*_fisher.png
