#!/bin/bash
# MPI-1216 grade-back on the shipped graph: Cosmo's real chain, a Turbo null chain, and the three
# runs the gate must leave alone (asked-for night, two pictures, Custom size reframe).
S='C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5499a12a-9d36-4bc1-b229-4b8966f5efec/scratchpad'
G='C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json'
IN=G:/ComfyUi/ComfyUI/input
B=(python -u "$S/bench.py" "$G")
LOG="$S/bench_out.log"
N='Keep the photo exactly as it is. Change nothing.'
P45="Add a second cliff ridge on the right-hand side of the frame: a separate rocky ledge of the same dark-brown layered rock, its top edge at roughly the same height as the ledge the people stand on, with a wide dark gap of open air between the two ridges — far enough apart to be jumped, with nothing bridging it. The new ridge runs off the right edge of the frame. Keep the six people, their positions, the flying saucers, the storm clouds and the lighting unchanged."
P46="Add a medium-sized dog standing on the second ridge at the right side of the frame, near the edge facing the group across the gap, in a lively alert posture — standing tall with front legs braced, head raised toward the people, mouth open mid-bark as if calling them over, tail up. Give it a warm light-brown coat with white markings on the chest. Keep the six people on the left ridge, both cliffs and the gap between them, the flying saucers, the clouds and the lighting unchanged."
run() { echo "== $1"; "${B[@]}" "$@" Input_wf_type=4 || exit 1; grep -a "MpiGradeBack" "$LOG" | tail -1; echo "lines: $(grep -ac MpiGradeBack "$LOG")"; }
run mpi1216v_45.png Input_is_Turbo=false Input_custom_size=false Input_Image=$IN/mpi1216c_e044.png "Input_Positive=$P45" Input_Seed=4239855902
run mpi1216v_46.png Input_is_Turbo=true Input_custom_size=false Input_Image=$IN/mpi1216v_45.png "Input_Positive=$P46" Input_Seed=1082825907
src=$IN/mpi1216c_t003.png
for i in 1 2 3; do run mpi1216v_N$i.png Input_is_Turbo=true Input_custom_size=false "Input_Image=$src" "Input_Positive=$N" Input_Seed=$((424242 + i)); src=$IN/mpi1216v_N$i.png; done
run mpi1216v_night.png Input_is_Turbo=true Input_custom_size=false Input_Image=$IN/mpi1216c_t003.png "Input_Positive=Make it night: a dark blue night sky with moonlight on the clouds, the people and the cliff lit only by the cold glow of the flying saucer." Input_Seed=7
run mpi1216v_multi.png Input_is_Turbo=true Input_custom_size=false Input_Image=$IN/mpi1216c_t003.png Input_Image_2=$IN/mpi1216v_46.png "Input_Positive=Add the dog from the second image standing on the cliff at the right of the six people, same pose and coat." Input_Seed=8
run mpi1216v_reframe.png Input_is_Turbo=true Input_custom_size=true Input_Width=1024 Input_Height=1024 Input_Image=$IN/mpi1216c_t003.png "Input_Positive=$N" Input_Seed=9
curl -s -X POST http://127.0.0.1:8188/free -H 'Content-Type: application/json' -d '{"unload_models":true,"free_memory":true}'
echo ALLDONE
