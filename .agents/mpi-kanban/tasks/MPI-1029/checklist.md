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

- [x] `AIMDO_FAULT_RE` matches aimdo's file-read failure line
- [x] `tests/dynamic-vram-fallback.test.cjs` covers the verbatim line
- [x] `docs/comfy.md` § Dynamic VRAM fallback names both fault classes
- Not done here: why the H3 TE stages twice per ref2v run (doubles the read volume) - separate question.
