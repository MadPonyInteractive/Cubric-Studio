#!/bin/bash
# MPI-1041 Phase E round 3 (qchecks3.py): per-view, per-half asks on round 2's ten sheets. Describer only.
# Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
echo "run_qchecks3.sh: start $(date +%H:%M:%S)"
python $B/qchecks3.py ask G:/ComfyUi/ComfyUI/output/mpi1041_age/checks || echo "ASK FAILED"
echo "run_qchecks3.sh: end $(date +%H:%M:%S)"
