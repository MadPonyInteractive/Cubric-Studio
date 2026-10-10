#!/bin/bash
# MPI-1041 A2: bench the converted Flow graph comfy_workflows/flow_character_sheet_edit.json on :8188, seed 42, on the two
# CLOTHED sheets (photo woman, 3D fisherman) - never a child age on the nude sheet. Default (no argument), in order:
#   1. the lock mask on its own (SAM3 + mask chain, seconds): does lock 1 / 2 cover the portrait FACE? vs batch 4's mask PNG
#      (the nude sheet appears here for that mask ONLY - no edit runs on it)
#   2. the lazy proof: which nodes EXECUTE at Input_Lock 0 / 1 / 2 (WebSocket), and only runs that return an image count
#   3. the cases (build_edit_graph.py cases()):
#        clo_<tee|biker|armour>  Input_Lock 1  batch 4/5 outfits, "the character" wording
#        hair_bob                Input_Lock 2  batch 8
#        cond_beaten             Input_Lock 0  batch 5
#        age10 / age30           Input_Lock 0  batch 15 v3 neutral exact-age template
#        mp1_age10               A/B: the same graph with megapixels forced to 1 (batch 15 ran at 1 MP, the graph runs at exact size)
#   4. output size == input size, layout.py heads, pairs sheets
# Slices (same wrapper, one argument after this file):
#   vocab     lock 1 vocabulary A/B, mask-only: "head, hair" vs "head, hair, face" on photo / fisher / nude (numbers only for nude)
#   clophoto  only the three lock-1 clothes cases on the photo sheet + layout + pairs
# Run ONLY under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file> [slice]
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
RUN=.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py
OUT=G:/ComfyUi/ComfyUI/output/mpi1041_age/graph_klein
IN=G:/ComfyUi/ComfyUI/input
PHOTO=$IN/mpi1042art_cafe2_sheet.png
FISHER=$IN/mpi1042art_fisher_sheet.png
mkdir -p $OUT
echo "run_graph_klein.sh ${1:-all}: start $(date +%H:%M:%S)"
if [ "$1" = "vocab" ]; then
  python $B/build_edit_graph.py vocabspec $OUT || exit 1
  python $RUN $OUT $OUT/vocab_spec.json || echo "VOCAB RUN FAILED"
  python $B/build_edit_graph.py vocabreport $OUT
  echo "run_graph_klein.sh vocab: done $(date +%H:%M:%S)"
  exit 0
fi
python $B/build_edit_graph.py spec $OUT || exit 1
if [ "$1" = "clophoto" ]; then
  for s in $OUT/case_clo_*_photo.json; do
    python $RUN $OUT $s || echo "CASE FAILED: $s"
  done
  python $B/layout.py $PHOTO $OUT/clo_*_photo.png
  python $B/pairs.py $OUT/pairs_clothes_photo.jpg $PHOTO $OUT/clo_tee_photo.png $OUT/clo_biker_photo.png $OUT/clo_armour_photo.png
  echo "run_graph_klein.sh clophoto: done $(date +%H:%M:%S)"
  exit 0
fi
python $B/build_edit_graph.py maskspec $OUT || exit 1
python $RUN $OUT $OUT/mask_spec.json || echo "MASK RUN FAILED"
python $B/build_edit_graph.py maskreport $OUT
python $B/build_edit_graph.py proof $OUT || echo "PROOF FAILED"
for s in $OUT/case_*.json; do
  python $RUN $OUT $s || echo "CASE FAILED: $s"
done
python $B/build_edit_graph.py check $OUT
python $B/layout.py $PHOTO $OUT/*_photo.png
python $B/layout.py $FISHER $OUT/*_fisher.png
python $B/pairs.py $OUT/pairs_clothes_photo.jpg $PHOTO $OUT/clo_tee_photo.png $OUT/clo_biker_photo.png $OUT/clo_armour_photo.png
python $B/pairs.py $OUT/pairs_clothes_fisher.jpg $FISHER $OUT/clo_tee_fisher.png $OUT/clo_biker_fisher.png $OUT/clo_armour_fisher.png
python $B/pairs.py $OUT/pairs_other_photo.jpg $PHOTO $OUT/hair_bob_photo.png $OUT/cond_beaten_photo.png $OUT/age10_photo.png $OUT/age30_photo.png
python $B/pairs.py $OUT/pairs_other_fisher.jpg $FISHER $OUT/hair_bob_fisher.png $OUT/cond_beaten_fisher.png $OUT/age10_fisher.png $OUT/age30_fisher.png
python $B/pairs.py $OUT/pairs_mp1_photo.jpg $PHOTO $OUT/age10_photo.png $OUT/mp1_age10_photo.png
python $B/pairs.py $OUT/pairs_mp1_fisher.jpg $FISHER $OUT/age10_fisher.png $OUT/mp1_age10_fisher.png
echo "run_graph_klein.sh: done $(date +%H:%M:%S)"
