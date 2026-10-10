#!/bin/bash
# MPI-1041 Phase E round 2 (qchecks2.py): two more ADULT test sheets, then four wordings x eight sheets x {sheet, front}.
# Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
RUN=.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age/checks
echo "run_qchecks2.sh: start $(date +%H:%M:%S)"
python $B/qchecks2.py spec $OUT || exit 1
for K in summer micro trunks boxers; do
  [ -f $OUT/$K.png ] || python $RUN $OUT $OUT/case_$K.json || echo "EDIT FAILED: $K"
done
python $B/qchecks2.py ask $OUT || echo "ASK FAILED"
echo "run_qchecks2.sh: end $(date +%H:%M:%S)"
