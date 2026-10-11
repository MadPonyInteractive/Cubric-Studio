#!/bin/bash
# MPI-1090 round 1 under the GPU lease. Outputs to the bench's output folder, log to the session scratchpad.
D=C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1090/research/bench
S=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/82476838-8c00-4ebb-8408-fde39eef109b/scratchpad
OUT=G:/ComfyUi/ComfyUI/output/mpi1090
python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- python -u $D/qg1.py $OUT >> $S/qg1.log 2>&1
echo "EXIT $? (qg1)" >> $S/qg1.log
