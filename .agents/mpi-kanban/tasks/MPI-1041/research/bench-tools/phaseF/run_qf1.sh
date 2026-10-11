#!/bin/bash
# MPI-1041 F1 bench under the GPU lease. Args pass through to qf1.py (case prefixes).
S=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/a7b3935e-77c3-4f5b-9376-f3d1a5834f0d/scratchpad
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_f1
python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.1/skills/mpi-lib/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- python $S/qf1.py $OUT "$1" >> $S/qf1.log 2>&1
echo "EXIT $?" >> $S/qf1.log
