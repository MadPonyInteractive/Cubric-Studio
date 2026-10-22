"""
generate_ltx25.py
LTX-2.5 handler (MPI-1095): from ONE i2v+t2v API export, produce the ONE app
workflow file, serving every op and both stages:

  ltx25_i2v_t2v.json  — int8 transformer  (the `ltx-25` card)

Same graph shape as LTX-2.3 (generate_ltx.py), so the same stage handshake and
sanity gates apply and are reused from there. What differs lives in the raw
graph itself, not here: 2.5 loaders, Gemma 4 on a plain CLIPLoader (projection
bundled), and none of the three baked 2.3 LoRAs (no 2.5 build exists; 2.5 needs
none for lip-sync or voice reference). One tier, so nothing is stamped.
"""

import json
from pathlib import Path

from generate_ltx import _bake_stage_one, _check_required


def build(source_path: Path, out_dir: Path) -> list[Path]:
    wf = json.loads(source_path.read_text(encoding="utf-8"))
    _check_required(wf, "Source template")
    _bake_stage_one(wf)
    out = out_dir / "ltx25_i2v_t2v.json"
    out.write_text(json.dumps(wf, indent=2), encoding="utf-8")
    print(f"  [OK]   {out.name}")
    return [out]
