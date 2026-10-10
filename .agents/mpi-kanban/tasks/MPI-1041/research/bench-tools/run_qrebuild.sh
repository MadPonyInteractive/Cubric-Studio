#!/bin/bash
# Child-sized body by rebuild (qrebuild.py): MPI-1042's from-images sheet from the de-aged portrait, 2 runs.
# Qwen arm by default; ARM=klein runs the Klein 9B arm (batch 18).
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age
IN=G:/ComfyUi/ComfyUI/input
python $B/qrebuild.py $OUT $ARM
python $B/height.py $IN/mpi1042art_cafe2_sheet.png $OUT/kleinv3_age10_photo.png $OUT/rebuild${ARM}_age10_photo.png
python $B/height.py $IN/mpi1042art_fisher_sheet.png $OUT/kleinv3_age10_fisher.png $OUT/rebuild${ARM}_age10_fisher.png
python $B/pairs.py $OUT/pairs_rebuild${ARM}_photo.jpg $IN/mpi1042art_cafe2_sheet.png $OUT/kleinv3_age10_photo.png $OUT/rebuild${ARM}_age10_photo.png
python $B/pairs.py $OUT/pairs_rebuild${ARM}_fisher.jpg $IN/mpi1042art_fisher_sheet.png $OUT/kleinv3_age10_fisher.png $OUT/rebuild${ARM}_age10_fisher.png
