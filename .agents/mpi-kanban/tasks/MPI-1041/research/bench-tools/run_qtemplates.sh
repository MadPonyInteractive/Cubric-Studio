#!/bin/bash
# MPI-1041 A4: the untested templates (teen 15, older 70, Accessories + clothes lock) and the describer asks, on :8188.
# CLOTHED sheets only for every edit. Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
# PHASE=edit | describe | gate | all (default all); ONLY=teen15,older70,accF,accL limits the edit cases; ASKSET=v1|v2.
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age/templates
IN=G:/ComfyUi/ComfyUI/input
PHASE=${PHASE:-all}
mkdir -p $OUT
echo "run_qtemplates.sh PHASE=$PHASE ONLY=$ONLY ASKSET=${ASKSET:-v1}"

if [ "$PHASE" = edit ] || [ "$PHASE" = all ]; then
  python $B/qtemplates.py edit $OUT || echo "STEP FAILED: qtemplates edit"
  for SH in photo fisher; do
    if [ $SH = photo ]; then SRC=$IN/mpi1042art_cafe2_sheet.png; else SRC=$IN/mpi1042art_fisher_sheet.png; fi
    if [ -z "$ONLY" ]; then
      FILES=$(ls $OUT/teen15_$SH.png $OUT/older70_$SH.png $OUT/accF_$SH.png $OUT/accL_$SH.png 2>/dev/null)
      TAG=all
    else   # a re-run of named cases: only those files, its own pairs sheet
      FILES=""
      for K in ${ONLY//,/ }; do FILES="$FILES $(ls $OUT/${K}_$SH.png 2>/dev/null)"; done
      TAG=${ONLY//,/_}
    fi
    echo "== layout $SH (heads within 16 px)"
    python $B/layout.py $SRC $FILES || echo "STEP FAILED: layout $SH"
    python $B/pairs.py $OUT/pairs_templates_${TAG}_$SH.jpg $SRC $FILES || echo "STEP FAILED: pairs $SH"
  done
fi

if [ "$PHASE" = describe ] || [ "$PHASE" = all ]; then
  python $B/qtemplates.py describe $OUT || echo "STEP FAILED: qtemplates describe"
fi

if [ "$PHASE" = gate ] || [ "$PHASE" = all ]; then
  python $B/qtemplates.py gate $OUT || echo "STEP FAILED: qtemplates gate"
fi
echo "run_qtemplates.sh done"
