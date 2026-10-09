#!/bin/bash
# Bench Q5 on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_q5
python $B/q5_headless.py $OUT
python $B/contact.py $OUT $OUT/contact_dressed.jpg "[FM]*_*.png" 3
python $B/contact.py $OUT $OUT/contact_redone.jpg "R_*.png" 3
