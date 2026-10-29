#!/bin/sh
# Packs-gone proof (MPI-1343): CPU scratch engine on 48199 from the G:\ComfyUi bench with every
# pack EXCEPT the five small packs (MpiNodes is a link to the working repo), then check_nodes.py.
#   sh run_nopacks.sh <scratch>
S="$1"
mkdir -p "$S/temp" "$S/out" "$S/in" "$S/user"
cd "G:/ComfyUi"
PACKS=$(ls ComfyUI/custom_nodes | grep -v -i -E 'ultimatesdupscale|cropandstitch|^lanpaint$|krea2edit|krea2-ostris-edit|__pycache__|\.disabled$|\.example$|\.py$')
./python_embeded/python.exe -s ComfyUI/main.py --listen 127.0.0.1 --port 48199 --cpu \
  --disable-all-custom-nodes --whitelist-custom-nodes $PACKS \
  --temp-directory "$S/temp" --output-directory "$S/out" --input-directory "$S/in" --user-directory "$S/user" \
  > "$S/engine.log" 2>&1 &
ENGINE=$!
trap 'kill $ENGINE 2>/dev/null; taskkill //PID $ENGINE //T //F >/dev/null 2>&1 || true' EXIT
curl -s --retry 60 --retry-connrefused --retry-delay 3 -m 300 -o /dev/null http://127.0.0.1:48199/system_stats
./python_embeded/python.exe -s "C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1344/research/check_nodes.py" 48199
curl -s http://127.0.0.1:48199/object_info | ./python_embeded/python.exe -c "import json,sys; d=json.load(sys.stdin); want=['MpiUltimateSDUpscale','MpiInpaintCrop','MpiInpaintStitch','MpiLanPaintKSampler','MpiLanPaintImageEncode','MpiLanPaintImageDecode','MpiKrea2EditModelPatch','MpiKrea2EditGroundedEncode','MpiKrea2OstrisEditModelPatch','MpiKrea2OstrisEditTextEncode']; print('new nodes registered:', sum(w in d for w in want), '/', len(want), [w for w in want if w not in d])"
grep -i -E "IMPORT FAILED|Cannot import" "$S/engine.log" || echo "no import failures"
grep -i "MpiNodes" "$S/engine.log" | head -5
