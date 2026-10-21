#!/bin/bash
# Final graph (D = gC rebuilt with the reframe switch): every case once, then the zoom chain.
S='C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5642ec09-25f5-4275-be88-99593a1ec0c8/scratchpad'
G="$S/gC/flux3_t2i.json"
IN=G:/ComfyUi/ComfyUI/input
B=(python -u "$S/bench.py" "$G")
P='Make the rat half its current size, keeping it in the same spot with the same grey coat, large pink ears and the brown nut held in its paws, and fill the ground it no longer covers with matching brown dirt, small grey pebbles and scattered dry leaves.'
"${B[@]}" t5_custom2k.png Input_wf_type=4 Input_is_Turbo=true Input_Image=$IN/mpi1216_e041.png "Input_Positive=$P" Input_Seed=1864072661 Input_custom_size=true Input_Width=1792 Input_Height=1120 || exit 1
"${B[@]}" t5_ratio.png Input_wf_type=4 Input_is_Turbo=true Input_Image=$IN/mpi1216_e041.png Input_custom_size=true Input_Width=896 Input_Height=1152 "Input_Positive=In <ref_image_0>, make it night with moonlight." Input_Seed=16 || exit 1
"${B[@]}" t5_t2i.png Input_wf_type=1 Input_is_Turbo=true Input_Width=1024 Input_Height=1024 "Input_Positive=A red fox in fresh snow, morning light." Input_Seed=11 || exit 1
"${B[@]}" t5_edit_mask.png Input_wf_type=4 Input_is_Turbo=true Input_Image=$IN/mpi1216_e041.png Input_Mask=$IN/mpi1216_mask041.png Input_custom_size=true Input_Width=1792 Input_Height=1120 "Input_Positive=In <ref_image_0>, replace the rat with a small orange kitten." Input_Seed=13 || exit 1
"${B[@]}" t5_multiref.png Input_wf_type=4 Input_is_Turbo=true Input_Image=$IN/mpi1216_e041.png Input_Image_2=$IN/mpi1216_in_3350x6000.png Input_custom_size=false "Input_Positive=In <ref_image_0>, put the straw hat from <ref_image_1> on the tiger's head." Input_Seed=15 || exit 1
src=$IN/mpi1216_d013.png
for i in 1 2 3; do
  "${B[@]}" mpi1216_D$i.png Input_wf_type=4 Input_is_Turbo=true Input_custom_size=false "Input_Image=$src" \
    "Input_Positive=In <ref_image_0>, keep the photo exactly as it is. Change nothing." Input_Seed=$((424242 + i)) || exit 1
  src=$IN/mpi1216_D$i.png
done
