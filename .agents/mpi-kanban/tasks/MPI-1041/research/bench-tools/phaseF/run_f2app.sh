#!/bin/bash
# MPI-1041 F2 in-app GPU cases on MY isolated instance, under the GPU lease. usage: run_f2app.sh <port> [case...]
D=C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/phaseF
S=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/86c11386-a0a2-479f-842b-5ebb2c2c4525/scratchpad
export CUBRIC_URL=http://127.0.0.1:$1
shift
CASES="${*:-f2_dress_photo f1_dress_photo f2_none_age60}"
python C:/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.1/skills/mpi-lib/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- python -u $D/f2app.py $CASES >> $S/f2app.log 2>&1
echo "EXIT $? (f2app)" >> $S/f2app.log
