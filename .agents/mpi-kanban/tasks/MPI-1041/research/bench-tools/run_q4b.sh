#!/bin/bash
# Bench Q4b on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_q4b
python $B/q4b_masklock.py $OUT mpi1041_nude_sheet.png mpi1041_mask_panels.png
python .agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py $OUT $OUT/mask_spec.json
cp $OUT/mask_head_hair.png G:/ComfyUi/ComfyUI/input/mpi1041_mask_panels.png
python .agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py $OUT $OUT/q4b_spec.json
python $B/contact.py $OUT $OUT/contact_ML1.jpg "ML1_2mp_*.png" 2
python $B/layout.py G:/ComfyUi/ComfyUI/input/mpi1041_nude_sheet.png $OUT/ML1_*.png
