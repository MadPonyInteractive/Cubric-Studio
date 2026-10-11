#!/bin/bash
# MPI-1041 F2 bench (optional reference picture) under the GPU lease: refs, then the edits.
S=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/a7b3935e-77c3-4f5b-9376-f3d1a5834f0d/scratchpad
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_f2
python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.1/skills/mpi-lib/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" -c "python $S/qf2.py refs $OUT && python $S/qf2.py edit $OUT $1" >> $S/qf2.log 2>&1
echo "EXIT $?" >> $S/qf2.log
