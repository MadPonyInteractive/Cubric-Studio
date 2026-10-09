#!/bin/bash
# Bench Hairstyle on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_hair
IN=G:/ComfyUi/ComfyUI/input
python $B/qhair.py $OUT
python $B/contact.py $OUT $OUT/contact_H.jpg "H_*.png" 2
python $B/contact.py $OUT $OUT/contact_HF.jpg "HF_*.png" 2
python $B/layout.py $IN/mpi1041_nude_sheet.png $OUT/H*_nude.png
python $B/layout.py $IN/mpi1042art_cafe2_sheet.png $OUT/H*_photo.png
