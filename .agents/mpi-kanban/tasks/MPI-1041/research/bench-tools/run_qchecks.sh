#!/bin/bash
# MPI-1041 Phase E: the two picture checks on the default describer. Three ADULT test sheets (Clothes edits on the
# photo woman), then both checks on six sheets. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
RUN=.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age/checks
echo "run_qchecks.sh: start $(date +%H:%M:%S)"
python $B/qchecks.py spec $OUT || exit 1
for K in bikini swimsuit lingerie; do
  [ -f $OUT/$K.png ] || python $RUN $OUT $OUT/case_$K.json || echo "EDIT FAILED: $K"
done
python $B/qchecks.py ask $OUT || echo "ASK FAILED"
echo "run_qchecks.sh: end $(date +%H:%M:%S)"
