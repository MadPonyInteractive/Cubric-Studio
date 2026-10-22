#!/usr/bin/env bash
# MPI-1232 stage 1: one GPU lease per run. Usage: bash stage1.sh krea2   (or flux3)
cd /c/AI/Mpi/Cubric-Vision || exit 1
R=.agents/mpi-kanban/tasks/MPI-1232/research
LEASE=/c/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py
M=$1
for F in 0 1; do
  for V in A B C; do
    python -I "$LEASE" run --poll 2 --timeout 7200 -- \
      python -I "$R/tilebench.py" run "$M" "$V" "$F" "$R/input_face.png" "$R/captions_face.json" "face_${M}_${V}_f${F}"
    echo "exit=$? $M $V $F"
  done
done
