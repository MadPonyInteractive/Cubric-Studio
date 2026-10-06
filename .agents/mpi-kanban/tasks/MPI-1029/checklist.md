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

## Next

- [ ] Fabio reruns the same H3 ref2v (dynamic VRAM on). Pass = a one-off, like MPI-774 fix 8
      (also H3 + aimdo hostbuf, never reproduced in 4 tries): close with no code.
- [ ] Fails again = real. Then measure, on that run only: `--disable-pinned-memory` (keeps
      dynamic VRAM; Comfy-Org/ComfyUI#14250 reports this exact `HostBuffer.read_file_slice
      failed` fixed by it) - its speed cost on H3 and one other model before it ships anywhere.
- [ ] The H3 TE staged TWICE in the one run (06:59:19Z and 07:00:12Z) - a separate session is
      finding out why; removing a second 25 GB pass halves the reads that hit 1450.
