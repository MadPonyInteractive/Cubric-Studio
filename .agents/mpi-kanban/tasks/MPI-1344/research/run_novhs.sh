#!/bin/sh
# Scratch engine on 48199: every pinned pack EXCEPT VideoHelperSuite (MPI-1337).
S="C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/60df419e-5646-443e-babc-3cf8b04a8fc3/scratchpad/novhs"
E="C:/AI/Mpi/Cubric-Vision/engine/ComfyUI_windows_portable"
mkdir -p "$S/temp" "$S/out" "$S/in" "$S/user"
cd "$E"
PACKS=$(ls ComfyUI/custom_nodes | grep -v -i -E 'videohelpersuite|__pycache__|\.disabled$|\.example$|\.py$')
exec ./python_embeded/python.exe -s ComfyUI/main.py --listen 127.0.0.1 --port 48199 --cpu \
  --disable-all-custom-nodes --whitelist-custom-nodes $PACKS \
  --temp-directory "$S/temp" --output-directory "$S/out" --input-directory "$S/in" --user-directory "$S/user" \
  > "$S/engine.log" 2>&1
