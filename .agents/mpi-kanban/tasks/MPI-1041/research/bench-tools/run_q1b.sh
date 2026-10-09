#!/bin/bash
# Bench Q1b on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_q1b
python $B/q1b_layout.py $OUT
python .agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py $OUT $OUT/q1b_spec.json
python $B/contact.py $OUT $OUT/contact_L1.jpg "L1_2mp_*.png" 2
python $B/contact.py $OUT $OUT/contact_L2.jpg "L2_2mp_*.png" 2
python $B/contact.py $OUT $OUT/contact_L2_1mp.jpg "L2_1mp_*.png" 1
python $B/layout.py G:/ComfyUi/ComfyUI/input/mpi1041_nude_sheet.png $OUT/L*.png
