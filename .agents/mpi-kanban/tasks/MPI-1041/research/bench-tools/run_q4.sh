#!/bin/bash
# Bench question 4 on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_q4
python $B/q4_masklock.py $OUT mpi1041_nude_sheet.png mpi1041_mask_head_hair.png
python .agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py $OUT $OUT/mask_spec.json
cp $OUT/mask_head_hair.png G:/ComfyUi/ComfyUI/input/mpi1041_mask_head_hair.png
python .agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py $OUT $OUT/q4_spec.json
python $B/contact.py $OUT $OUT/contact_M.jpg "M_2mp_*.png" 2
