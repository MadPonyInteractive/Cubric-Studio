#!/bin/bash
# Big photo: 3350x6000 -> capped 2192x3936. Shipped (A) vs fix (C). VRAM sampled every 2 s.
S='C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5642ec09-25f5-4275-be88-99593a1ec0c8/scratchpad'
for g in C A; do
  G="$S/flux3_A.json"; [ $g = C ] && G="$S/gC/flux3_t2i.json"
  ( while true; do nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits >> "$S/t3_vram_$g.txt"; sleep 2; done ) &
  mon=$!
  python -u "$S/bench.py" "$G" t3_$g.png Input_wf_type=4 Input_is_Turbo=true Input_custom_size=false \
    Input_Image=G:/ComfyUi/ComfyUI/input/mpi1216_in_3350x6000.png "Input_Positive=In <ref_image_0>, make the sky a warm sunset. Keep everything else exactly as it is." Input_Seed=777
  kill $mon
  echo "peak VRAM $g: $(sort -n "$S/t3_vram_$g.txt" | tail -1) MiB"
done
