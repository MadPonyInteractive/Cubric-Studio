#!/bin/bash
# The fisher at 10: two-pass on Klein + a no-beard clause on Klein / Boogu (qage2p.py), 5 edits on :8188. Lease only:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age
IN=G:/ComfyUi/ComfyUI/input
python $B/qage2p.py $OUT
S="$OUT/klein2palone_age10_fisher.png $OUT/klein2pref_age10_fisher.png $OUT/kleinnb_age10_fisher.png $OUT/boogunb_age10_fisher.png"
python $B/layout.py $IN/mpi1042art_fisher_sheet.png $S
python $B/pairs.py $OUT/pairs_age_b14_fisher.jpg $IN/mpi1042art_fisher_sheet.png $S
