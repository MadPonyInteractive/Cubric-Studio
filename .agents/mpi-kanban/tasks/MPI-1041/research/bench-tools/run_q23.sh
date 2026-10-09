#!/bin/bash
# Bench Q2 + Q3 on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_q23
IN=G:/ComfyUi/ComfyUI/input
python $B/q23_state_body_age.py $OUT
python .agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py $OUT $OUT/q23_spec.json
python $B/contact.py $OUT $OUT/contact_Q2.jpg "Q2_*.png" 2
python $B/contact.py $OUT $OUT/contact_Q3b.jpg "Q3b_*.png" 2
python $B/contact.py $OUT $OUT/contact_Q3a.jpg "Q3a_*.png" 2
python $B/contact.py $OUT $OUT/contact_LN.jpg "LN_*.png" 1
python $B/layout.py $IN/mpi1041_nude_sheet.png $OUT/*_nude*.png
python $B/layout.py $IN/mpi1042art_cafe2_sheet.png $OUT/*_photo*.png
python $B/layout.py $IN/mpi1042art_fisher_sheet.png $OUT/*_fisher*.png
python $B/layout.py $IN/mpi1042art_anime_sheet.png $OUT/*_anime*.png
