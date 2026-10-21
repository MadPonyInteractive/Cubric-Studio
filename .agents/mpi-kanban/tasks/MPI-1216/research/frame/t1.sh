#!/bin/bash
# Cosmo's case: edit_041 (1280x800) at Custom size 8:5 2K = 1792x1120, shipped (A) vs fix (C).
S='C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5642ec09-25f5-4275-be88-99593a1ec0c8/scratchpad'
P='Make the rat half its current size, keeping it in the same spot with the same grey coat, large pink ears and the brown nut held in its paws, and fill the ground it no longer covers with matching brown dirt, small grey pebbles and scattered dry leaves.'
COMMON=(Input_wf_type=4 Input_is_Turbo=true Input_Image=G:/ComfyUi/ComfyUI/input/mpi1216_e041.png "Input_Positive=$P" Input_Seed=1864072661)
for g in A C; do
  G="$S/flux3_A.json"; [ $g = C ] && G="$S/gC/flux3_t2i.json"
  python -u "$S/bench.py" "$G" t1_${g}_custom2k.png "${COMMON[@]}" Input_custom_size=true Input_Width=1792 Input_Height=1120
  python -u "$S/bench.py" "$G" t1_${g}_off.png "${COMMON[@]}" Input_custom_size=false
done
