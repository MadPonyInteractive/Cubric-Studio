#!/bin/bash
# Child-sized body by rebuild (qrebuild.py): MPI-1042's from-images sheet (Qwen arm) from the de-aged portrait, 2 runs.
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age
IN=G:/ComfyUi/ComfyUI/input
python $B/qrebuild.py $OUT
python $B/height.py $IN/mpi1042art_cafe2_sheet.png $OUT/kleinv3_age10_photo.png $OUT/rebuild_age10_photo.png
python $B/height.py $IN/mpi1042art_fisher_sheet.png $OUT/kleinv3_age10_fisher.png $OUT/rebuild_age10_fisher.png
python $B/pairs.py $OUT/pairs_rebuild_photo.jpg $IN/mpi1042art_cafe2_sheet.png $OUT/kleinv3_age10_photo.png $OUT/rebuild_age10_photo.png
python $B/pairs.py $OUT/pairs_rebuild_fisher.jpg $IN/mpi1042art_fisher_sheet.png $OUT/kleinv3_age10_fisher.png $OUT/rebuild_age10_fisher.png
