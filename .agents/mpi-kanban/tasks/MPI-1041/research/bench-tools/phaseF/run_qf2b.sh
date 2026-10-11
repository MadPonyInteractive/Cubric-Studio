#!/bin/bash
# MPI-1041 F2 round 2 (reference + the F1 wordings) under the GPU lease.
S=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/a7b3935e-77c3-4f5b-9376-f3d1a5834f0d/scratchpad
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_f2
python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.1/skills/mpi-lib/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- python -u $S/qf2b.py $OUT >> $S/qf2.log 2>&1
echo "EXIT $? (qf2b)" >> $S/qf2.log
