#!/usr/bin/env bash
# MPI-1232 stage 2: Krea 2, turbo, face pass on. A (no tile prompt) + C with each describer method's captions.
# One GPU lease per run; skips outputs that exist. Usage: bash stage2.sh
cd /c/AI/Mpi/Cubric-Vision || exit 1
R=.agents/mpi-kanban/tasks/MPI-1232/research
LEASE=/c/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py
run() {  # variant captions tag
  [ -f "$R/out/$3.png" ] && return
  python -I "$LEASE" run --poll 2 --timeout 7200 -- \
    python -I "$R/tilebench.py" run krea2 "$1" 1 "$R/input_field.png" "$2" "$3"
  echo "exit=$? $3"
}
run A - field_krea2_A_f1
for M in 1 2 3 4; do run C "$R/captions_field_$M.json" "field_krea2_C_cap$M"; done
