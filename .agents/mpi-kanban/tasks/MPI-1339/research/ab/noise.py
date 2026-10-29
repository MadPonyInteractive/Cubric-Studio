"""MPI-1339 tiles noise floor: each tiles graph (Impact, Mpi) twice on the same engine.

Reuses ab.py's helpers (everything above its job list). Needs ab_src.png already in <input_dir>.
  python noise.py <before_dir> <input_dir>
"""
import pathlib, sys

src = (pathlib.Path(__file__).parent / "ab.py").read_text(encoding="utf-8")
exec(src[:src.index("SDXL_NEW, SDXL_OLD")])

SDXL_NEW, SDXL_OLD = WF / "t2i_sdxl_realistic.json", BEFORE / "t2i_sdxl_realistic.json"
inj = {("Input_wf_type", "int"): 7, ("Input_Tile_Upscale", "boolean"): True, ("Input_Image", "string"): "ab_src.png"}
runs = {}
for label, g in [("impact1", SDXL_OLD), ("impact2", SDXL_OLD), ("mpi1", SDXL_NEW), ("mpi2", SDXL_NEW)]:
    runs[label] = run(sdxl(g, inj), f"noise_{label}")
compare("impact1 vs impact2", runs["impact1"], runs["impact2"])
compare("mpi1 vs mpi2", runs["mpi1"], runs["mpi2"])
compare("impact1 vs mpi1", runs["impact1"], runs["mpi1"])
(HERE / "noise_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
print("\n".join(report))
