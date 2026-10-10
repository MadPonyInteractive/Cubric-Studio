#!/bin/bash
# Body shape + Age, 5 edits on ONE editor (qwen21 | boogu | qwenedit | krea2) on :8188. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file> <model>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
M=$1
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_qba
IN=G:/ComfyUi/ComfyUI/input
python $B/qba.py $M $OUT
python $B/contact.py $OUT $OUT/contact_$M.jpg "${M}_*.png" 2
python $B/layout.py $IN/mpi1041_nude_sheet.png $OUT/${M}_*_nude.png
python $B/layout.py $IN/mpi1042art_cafe2_sheet.png $OUT/${M}_*_photo.png
python $B/layout.py $IN/mpi1042art_fisher_sheet.png $OUT/${M}_*_fisher.png
