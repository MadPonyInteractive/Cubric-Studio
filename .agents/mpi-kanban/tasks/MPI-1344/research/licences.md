# Licences of the pinned node packs (MPI-1344, Phase 0)

Read 2026-10-29 from `engine/ComfyUI_windows_portable/ComfyUI/custom_nodes/` (every pack's
`.mpi_node_commit` matched its `dev_configs/node_lock.json` pin). MpiNodes is **AGPL-3.0**.

| Pack | Licence | Porting into MpiNodes (AGPL-3.0) | Card |
|---|---|---|---|
| comfyui_controlnet_aux | Apache-2.0 (its vendored OpenPose code is CMU non-commercial research only) | copy OK, keep NOTICE/attribution; OpenPose part carries the CMU restriction | MPI-1338 |
| ComfyUI-Impact-Pack | GPL-3.0 | copy OK (GPL-3 → AGPL-3 allowed), keep notices | MPI-1339 |
| ComfyUI-Impact-Subpack | AGPL-3.0 | copy OK | MPI-1339 |
| **RES4LYF** | **AGPL-3.0 + a no-commercial-service preamble** (corrected 2026-10-29) | **NOT copy OK: the preamble bans any derivative used in a service that charges users directly or indirectly, even inside a larger product. Ask the author or clean-room rewrite** | MPI-1340 |
| comfyui-kjnodes | GPL-3.0 | copy OK | MPI-1341 |
| ComfyUI-Mickmumpitz-Nodes | MIT | copy OK, keep MIT notice | MPI-1342 |
| audio-separation-nodes-comfyui | MIT | copy OK | MPI-1342 |
| ComfyUI-Frame-Interpolation | MIT | copy OK (RIFE weights: check separately) | MPI-1342 |
| comfyui-krea2edit | Apache-2.0 | copy OK | MPI-1343 |
| ComfyUI-Krea2-Ostris-Edit | MIT | copy OK | MPI-1343 |
| comfyui-inpaint-cropandstitch | GPL-3.0 | copy OK | MPI-1343 |
| LanPaint | GPL-3.0 | copy OK | MPI-1343 |
| ComfyUI-UltimateSDUpscale | GPL-3.0 | copy OK | MPI-1343 |
| **ComfyUI-PainterI2Vadvanced** | **none** | **no licence = all rights reserved: rewrite from scratch or ask the author** | MPI-1343 |
| **ComfyUI-Krea2-ControlNet** | **none** | **same — rewrite or ask** | MPI-1343 |
| **Comfyui_Minimax_h3_latent_Upscaler** | **none** | **same — rewrite or ask** | MPI-1343 |
| ComfyUI-VideoHelperSuite | GPL-3.0 | dropped, nothing ported | MPI-1337 |
| ComfyUI-LTXVideo | LTX-2 Community Licence | kept | — |
| ComfyUI-GGUF | Apache-2.0 | kept | — |
| ComfyUI-MelodramaBox | Apache-2.0 | kept (our fork) | — |
| ComfyUI_Fill-ChatterBox | no LICENSE file (pyproject points at a missing one) | kept | — |

Not covered here: **model weights**. The Impact detector chain loads Ultralytics YOLO
`.pt` files (AGPL); the RIFE and DepthAnything/OpenPose weights carry their own terms.
Each porting card checks the weights it touches.

Weights found in Phase 1 (2026-10-29): OpenPose body/hand/face = CMU non-commercial research only;
Depth-Anything-V2 Small = Apache-2.0, Base/Large/Giant = CC-BY-NC-4.0 (AIO depth defaults to Large).
The Phase 0 read checked only the AGPL text, not preambles: re-read the top of every LICENSE.
