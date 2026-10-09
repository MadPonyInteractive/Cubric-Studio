#!/bin/bash
# Bench question 1 on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 3 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_q1
python .agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py $OUT $OUT/q1_spec.json
python .agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/contact.py $OUT $OUT/contact_W1.jpg "W_1mp_*.png" 2
python .agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/contact.py $OUT $OUT/contact_W2.jpg "W_2mp_*.png" 2
python .agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/contact.py $OUT $OUT/contact_N.jpg "N_*.png" 1
