#!/bin/bash
# MPI-1041 F2 round 5 (take the old clothes off) under the GPU lease.
D=C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/phaseF
S=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/86c11386-a0a2-479f-842b-5ebb2c2c4525/scratchpad
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_f2
python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.1/skills/mpi-lib/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- python -u $D/qf2f.py $OUT >> $S/qf2f.log 2>&1
echo "EXIT $? (qf2f)" >> $S/qf2f.log
