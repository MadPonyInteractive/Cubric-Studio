#!/bin/bash
# MPI-1216 colour drift: null-edit chains (Turbo/base x clause/none) from t2i_003,
# then Cosmo's real 045 -> 046 prompts from edit_044 (base, Turbo) with and without the clause.
S='C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5499a12a-9d36-4bc1-b229-4b8966f5efec/scratchpad'
G='C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json'
IN=G:/ComfyUi/ComfyUI/input
B=(python -u "$S/bench.py" "$G")
K='Keep the colour grade, white balance, saturation, contrast and brightness exactly as in the image.'
N='Keep the photo exactly as it is. Change nothing.'
P45="Add a second cliff ridge on the right-hand side of the frame: a separate rocky ledge of the same dark-brown layered rock, its top edge at roughly the same height as the ledge the people stand on, with a wide dark gap of open air between the two ridges — far enough apart to be jumped, with nothing bridging it. The new ridge runs off the right edge of the frame. Keep the six people, their positions, the flying saucers, the storm clouds and the lighting unchanged."
P46="Add a medium-sized dog standing on the second ridge at the right side of the frame, near the edge facing the group across the gap, in a lively alert posture — standing tall with front legs braced, head raised toward the people, mouth open mid-bark as if calling them over, tail up. Give it a warm light-brown coat with white markings on the chest. Keep the six people on the left ridge, both cliffs and the gap between them, the flying saucers, the clouds and the lighting unchanged."
edit() { "${B[@]}" "$1" Input_wf_type=4 Input_is_Turbo=$2 Input_custom_size=false "Input_Image=$3" "Input_Positive=$4" Input_Seed=$5 || exit 1; }
for turbo in true false; do
  for k in none keep; do
    tag=mpi1216c_N${turbo:0:1}${k:0:1}; src=$IN/mpi1216c_t003.png; p="$N"; [ $k = keep ] && p="$N $K"
    for i in 1 2 3; do edit ${tag}$i.png $turbo "$src" "$p" $((424242 + i)); src=$IN/${tag}$i.png; done
  done
done
for k in none keep; do
  a="$P45"; b="$P46"; [ $k = keep ] && { a="$P45 $K"; b="$P46 $K"; }
  edit mpi1216c_R${k:0:1}45.png false $IN/mpi1216c_e044.png "$a" 4239855902
  edit mpi1216c_R${k:0:1}46.png true $IN/mpi1216c_R${k:0:1}45.png "$b" 1082825907
done
curl -s -X POST http://127.0.0.1:8188/free -H 'Content-Type: application/json' -d '{"unload_models":true,"free_memory":true}'
echo ALLDONE
