# MPI-1029 checklist

Fabio, 2026-10-06, source run, RTX 4060 Ti 16 GB / 64 GB RAM: a MiniMax H3 ref2v (`ref2v_ms`,
`minimax-h3-ref2va`) failed after ~2 min with `MpiH3References failed: RuntimeError:
HostBuffer.read_file_slice failed`.

Evidence (`%APPDATA%\Cubric Studio\logs\app.log`, 2026-10-06T07:00:54Z): three
`aimdo: src-win/xfer-file-plat.c:43:ERROR:xfer_file_read_at: GetOverlappedResult failed error=1450`
then `aimdo: src/hostbuf.c:275:ERROR:hostbuf_read_file_slice: file read failed`, on the 25 GB H3
text encoder (`qwen3vl_32b_h3_..._int8_convrot.safetensors`, size on disk = dep `bytes`, offset in
range: not a damaged file). Fresh engine, one prompt, no Stop. The TE staged twice in the run.

Root cause: Windows ERROR_NO_SYSTEM_RESOURCES on comfy-aimdo's unbuffered overlapped weight reads.
Upstream, open (comfy-aimdo 0.4.15); the known workaround is `--disable-dynamic-vram`, which is
exactly the MPI-1024 fallback. That fallback's detector (`AIMDO_FAULT_RE`, `routes/comfy.js`)
only knew the allocation fault, so this fault class left the engine in the mode that fails.

## REVERTED (Fabio, 2026-10-06)

Shipped in 806cd12bb and reverted the same morning: extending the MPI-1024 fallback to this
fault meant ONE H3 read error put the whole rest of the session on `--disable-dynamic-vram`,
1.3-1.65x slower on every model (MPI-1024 Phase B: H3 ref2v 136 s -> 224 s), and it did not even
save the run that failed. The MPI-1024 crash kills the engine, so a restart costs nothing extra
there; this fault leaves the engine alive (`Prompt executed`), so the restart buys nothing.
Never fix a one-off fault with a session-wide slowdown.

## Next - 2.0.1 is ON HOLD for this card (Fabio, 2026-10-06)

Lead (not proven): the two TE stagings are BY DESIGN (MPI-1030: two `MpiH3References`, stage-1
match + refine max), and an `MpiClearVram` runs between them. `MpiClearVram`
(`ComfyUi-MpiNodes/vram.py`) = `unload_all_models()` + `soft_empty_cache()` - the "Clean/Unload"
of Comfy-Org/ComfyUI#15352: MiniMax H3 INT8 ConvRot + aimdo DynamicVRAM on Windows, 64 GB RAM,
`HostBuffer.read_file_slice failed` on the load AFTER a Clean/Unload. Reporter's analysis: WDDM
charges registered (pinned) host memory and aimdo residency against ONE system budget, and pins
reused after a Clean skip the budget check. Ours failed in stage 2, right after the clear.
ComfyUI pins up to 40% of RAM on Windows (`MAX_PINNED_MEMORY`, `Enabled pinned memory 26124.0`).

- [ ] Fabio reruns the same H3 ref2v unchanged: does stage 2 fail again?
- [ ] If yes: local, uncommitted `--disable-pinned-memory` in `_cudaModeArgs()`, app restart,
      same job - pass? And its time cost on H3 + one image model. (ComfyUI#14250: the same
      error string fixed by that flag. Dynamic VRAM stays ON.)
- [ ] Ship only what passes at an acceptable cost. Not for 2.0.1: an aimdo bump (0.4.15 ->
      0.5.x reportedly tracks the WDDM budget) = a full /mpi-bump-engine run.
