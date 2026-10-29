# MPI-1343 — Engine diet: fold the small no-requirement packs into MpiNodes

Part of umbrella MPI-1344 (read its Cross-cutting rules). Same recipe as MPI-1341 (`kj/`).

## Scope (decided 2026-10-29)

Port (licence re-read 2026-10-29: stock GPL-3 / Apache-2 / MIT text, no preamble):

| Pack (pin) | Licence | Node -> new name | Used by |
|---|---|---|---|
| comfyui_ultimatesdupscale (bebd569) | GPL-3 (+ vendored ultimate_sd_upscale GPL-3) | UltimateSDUpscale -> MpiUltimateSDUpscale | 14 t2i graphs |
| comfyui-inpaint-cropandstitch (3617559) | GPL-3 | InpaintCropImproved -> MpiInpaintCrop, InpaintStitchImproved -> MpiInpaintStitch | 20 graphs + paid Head Swap |
| LanPaint (9fe9195) | GPL-3 | LanPaint_ImageEncode/ImageDecode/KSampler -> MpiLanPaintImageEncode/ImageDecode/KSampler | 14 graphs |
| comfyui-krea2edit (223a938) | Apache-2 | Krea2EditGroundedEncode, Krea2EditModelPatch -> Mpi* | krea2 |
| ComfyUI-Krea2-Ostris-Edit (7756566) | MIT | Krea2OstrisEditModelPatch, TextEncodeKrea2OstrisEdit -> MpiKrea2OstrisEditModelPatch, MpiKrea2OstrisEditTextEncode | flow_pano360 |

STAY as dependencies (no licence = all rights reserved; Fabio's 2026-10-29 rule: restricted code is
never ported, rewritten or asked for): ComfyUI-PainterI2Vadvanced, ComfyUI-Krea2-ControlNet,
Comfyui_Minimax_h3_latent_Upscaler. (ComfyUI master adds a native MiniMax H3 latent upscaler, not in
a tagged release yet: a later swap candidate.)

## Steps

1. MpiNodes: one subpackage per pack (`usdu/`, `cropstitch/`, `lanpaint/`, `krea2edit/`), licence
   files alongside, header naming source + licence, registry-safety scan (no eval/exec/subprocess/
   network), tests. Commit -> push -> `/mpi-nodes-sync` pin.
2. Vision: swap class_types in the 46 files (API + raw + workflow_generation), inputs untouched,
   each file proven equal to the intended JSON mutation; drop the 5 packs from node_lock, nodesDeps,
   models.js dep lists; Pod copies in mpi-ci; tests that name the old classes.
3. Head Swap paid Flow: swap Inpaint Crop/Stitch in c:/AI/Mpi/Cubric-Flows (fold into 1.1.0 if not
   uploaded yet, else 1.1.1).
4. Verify: lint + npm test; packs-gone scratch engine (`research/run_nokj.sh` pattern in MPI-1341);
   fixed-seed A/B per node family (usdu, crop/stitch, lanpaint, krea2edit, ostris) identical.
5. Release note naming the removed classes. Commit code with the card in doing; close after CI.

**Verify mode:** auto

## Current State
2026-10-29: steps 1-3 and 5 done. MpiNodes 4d8b87e (usdu/, cropstitch/, lanpaint/, krea2edit/; CPU
tests compare each with the pinned original: usdu 12 modes, LanPaint 36 sampler runs, crop/stitch 3
workflow settings, krea2 code identical bar renames) pushed and pinned. 46 graphs swapped (272
replacements, each proven equal to the JSON mutation), 5 packs out of node_lock/nodesDeps/models.js,
progressAggregator keys MpiUltimateSDUpscale. lint OK, npm test 3824/0. Packs-gone CPU engine: every
shipped graph node present (`research/run_nopacks.sh`). Head Swap 1.1.1 pushed in Cubric-Flows.
Submodule install code has no consumer now (USDU was the only one); its two tests put USDU's last pin
back as a fixture.
NEXT: GPU A/B (`research/ab/run_ab.sh` under gpu_lease) must read IDENTICAL for all 5 cases, then
close after CI. Fabio: upload head-swap.zip 1.1.1 to Gumroad.
