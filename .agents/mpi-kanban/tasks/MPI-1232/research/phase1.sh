#!/usr/bin/env bash
# MPI-1232 Phase 1 verify: one leased turbo run per family on the shipped runtime graph. Skips outputs that exist.
cd /c/AI/Mpi/Cubric-Vision || exit 1
R=.agents/mpi-kanban/tasks/MPI-1232/research
LEASE=/c/Users/Fabio/.claude/plugins/cache/mad-pony-interactive/mpi-kanban/1.6.2/skills/mpi-lib/scripts/gpu_lease.py
for G in ${@:-krea2_t2i_sfw flux3_t2i moss_t2i klein_t2i chroma_t2i t2i_sdxl_realistic qwen_image_2_1}; do
  [ -f "$R/out/p1_${G}.png" ] && continue
  python -I "$LEASE" run --poll 2 --timeout 7200 -- python "$R/phase1verify.py" "$G" "$R/input_face.png" "p1_${G}"
  echo "exit=$? $G"
done
