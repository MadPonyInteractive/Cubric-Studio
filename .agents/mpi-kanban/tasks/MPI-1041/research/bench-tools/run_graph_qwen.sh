#!/bin/bash
# MPI-1041 A3: the Flow's OWN Qwen-Image 2.1 edit graph (comfy_workflows/flow_character_sheet_edit_qwen.json, the converted
# API file) on the BENCH :8188, batch 9's three body cases (qba.py CASES + TAIL, seed 42) + one odd-size input. Run ONLY
# under the lease:
#   python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <this file>
# Outputs ONLY under OUT (the nude-sheet results never leave it, never the repo). The one odd-size INPUT goes to
# input/mpi1041_graph_qwen/: the loader reads only input/ and the bench's own output dir (D:/WORK/Images/Outputs), NOT OUT,
# so an OUT path blocks the loader and the run ends "success" in 3 s with no image.
# Resumable: a case whose PNG exists is skipped while graph_sha1.txt matches the graph file; delete a PNG to redo a case.
set -e
cd C:/AI/Mpi/Cubric-Vision
B=.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools
RUN_API=.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py
API=comfy_workflows/flow_character_sheet_edit_qwen.json
OLD=G:/ComfyUi/ComfyUI/output/mpi1041_qba
OUT=$OLD/graph_qwen
IN=G:/ComfyUi/ComfyUI/input
ODD=$IN/mpi1041_graph_qwen/odd_in_photo.png
mkdir -p $OUT $IN/mpi1041_graph_qwen
echo "run_graph_qwen: $(date +%H:%M:%S) start; graph $API"

# an input that is NOT a multiple of 32 (1770x1100 -> the encoder rounds to 1760x1088): the output must come back 1770x1100
python -c 'from PIL import Image; Image.open("G:/ComfyUi/ComfyUI/input/mpi1042art_cafe2_sheet.png").convert("RGB").resize((1770, 1100), Image.LANCZOS).save("G:/ComfyUi/ComfyUI/input/mpi1041_graph_qwen/odd_in_photo.png")'

# the spec: wording VERBATIM from qba.py (asserted below), batch 9's order; the app injects Input_Image into image AND string
python -c '
import hashlib, json, os, sys
api, out, qba = sys.argv[1:4]
Q = chr(39)
TAIL = " Make the same change in the close-up portrait on the right. Keep everything else exactly as it is."
CASES = [("muscular", "nude", "Make the character" + Q + "s body muscular and athletic."),
         ("heavy", "photo", "Make the character" + Q + "s body heavyset and overweight."),
         ("skinny", "nude", "Make the character" + Q + "s body very skinny."),
         ("heavy", "photo_odd", "Make the character" + Q + "s body heavyset and overweight.")]
SHEETS = {"nude": "mpi1041_nude_sheet.png", "photo": "mpi1042art_cafe2_sheet.png",
          "photo_odd": "mpi1041_graph_qwen/odd_in_photo.png"}
src = open(qba, encoding="utf-8").read()
for _, _, p in CASES:
    assert p in src, "qba.py no longer has this case wording: " + p
assert TAIL in src, "qba.py TAIL changed"
sha = hashlib.sha1(open(api, "rb").read()).hexdigest()
stamp = out + "/graph_sha1.txt"
same = os.path.exists(stamp) and open(stamp).read().strip() == sha
open(stamp, "w").write(sha + "\n")
todo = [(k, sh, p) for k, sh, p in CASES if not (same and os.path.exists(out + "/graphqwen_%s_%s.png" % (k, sh)))]
spec = [{"tag": "graphqwen_%s_%s" % (k, sh), "api": api, "set": {
    "Input_Image": {"image": SHEETS[sh], "string": SHEETS[sh]}, "Input_Positive": {"string": p + TAIL},
    "Input_Seed": {"int": 42}}} for k, sh, p in todo]
json.dump(spec, open(out + "/spec.json", "w", encoding="utf-8"), indent=1)
print("graph sha1", sha[:12], "unchanged" if same else "NEW", "| to run:", [s["tag"] for s in spec] or "nothing (all done)")
' $API $OUT $B/qba.py

python $RUN_API $OUT $OUT/spec.json

echo "--- sizes (input -> output)"
python -c '
from PIL import Image
o = "G:/ComfyUi/ComfyUI/output/mpi1041_qba/graph_qwen/"
i = "G:/ComfyUi/ComfyUI/input/"
for tag, src in (("muscular_nude", i + "mpi1041_nude_sheet.png"), ("heavy_photo", i + "mpi1042art_cafe2_sheet.png"),
                 ("skinny_nude", i + "mpi1041_nude_sheet.png"), ("heavy_photo_odd", i + "mpi1041_graph_qwen/odd_in_photo.png")):
    a, b = Image.open(src), Image.open(o + "graphqwen_" + tag + ".png")
    print(tag.ljust(18), a.size, "->", b.size, b.mode, "SAME" if a.size == b.size else "DIFFERENT")
'

echo "--- width.py: batch 9 (qwen21_*) and this graph (graphqwen_*), % vs the original"
python $B/width.py $IN/mpi1041_nude_sheet.png $OLD/qwen21_muscular_nude.png $OUT/graphqwen_muscular_nude.png $OLD/qwen21_skinny_nude.png $OUT/graphqwen_skinny_nude.png
python $B/width.py $IN/mpi1042art_cafe2_sheet.png $OLD/qwen21_heavy_photo.png $OUT/graphqwen_heavy_photo.png
python $B/width.py $ODD $OUT/graphqwen_heavy_photo_odd.png

echo "--- layout.py (heads / seam shift in sheet px; batch 9 held within 11 px)"
python $B/layout.py $IN/mpi1041_nude_sheet.png $OLD/qwen21_muscular_nude.png $OUT/graphqwen_muscular_nude.png $OLD/qwen21_skinny_nude.png $OUT/graphqwen_skinny_nude.png
python $B/layout.py $IN/mpi1042art_cafe2_sheet.png $OLD/qwen21_heavy_photo.png $OUT/graphqwen_heavy_photo.png

echo "--- mean abs RGB difference to batch 9 output of the same case (0-255; 0 = the same picture)"
python -c '
import numpy as np
from PIL import Image
o = "G:/ComfyUi/ComfyUI/output/mpi1041_qba/"
for tag in ("muscular_nude", "heavy_photo", "skinny_nude"):
    a = np.asarray(Image.open(o + "qwen21_" + tag + ".png").convert("RGB"), dtype=np.float32)
    b = np.asarray(Image.open(o + "graph_qwen/graphqwen_" + tag + ".png").convert("RGB"), dtype=np.float32)
    print(tag.ljust(16), "mean %.2f  max %d  >8 levels: %.2f%%" % (np.abs(a - b).mean(), np.abs(a - b).max(), 100 * (np.abs(a - b).max(axis=2) > 8).mean()))
'

echo "--- pairs (original, batch 9, this graph) - inside graph_qwen only"
python $B/pairs.py $OUT/pairs_graphqwen_nude.jpg $IN/mpi1041_nude_sheet.png $OLD/qwen21_muscular_nude.png $OUT/graphqwen_muscular_nude.png $OLD/qwen21_skinny_nude.png $OUT/graphqwen_skinny_nude.png
python $B/pairs.py $OUT/pairs_graphqwen_photo.jpg $IN/mpi1042art_cafe2_sheet.png $OLD/qwen21_heavy_photo.png $OUT/graphqwen_heavy_photo.png
python $B/pairs.py $OUT/pairs_graphqwen_odd.jpg $ODD $OUT/graphqwen_heavy_photo_odd.png
echo "run_graph_qwen: $(date +%H:%M:%S) done"
