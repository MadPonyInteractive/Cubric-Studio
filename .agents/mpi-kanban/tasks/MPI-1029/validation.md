# MPI-1029 validation

## Fix

`routes/comfy.js` `AIMDO_FAULT_RE` now also matches aimdo's weight-read failure
(`aimdo: ...hostbuf_read_file_slice: file read failed`), so the MPI-1024 fallback (restart the
engine with `--disable-dynamic-vram` for the rest of the session) covers it. Docs:
`docs/comfy.md` § Dynamic VRAM fallback.

## Evidence (2026-10-06)

- Log (Fabio's source run, `%APPDATA%\Cubric Studio\logs\app.log`): fresh engine 06:55:36Z, one
  prompt 06:58:51Z, H3 TE `25140MB Staged` at 06:59:19Z and again 07:00:12Z, then three
  `GetOverlappedResult failed error=1450` + the `hostbuf_read_file_slice: file read failed` line
  at 07:00:54Z. No Stop, no second prompt. No earlier aimdo fault, so `dynamicVramOff` was false.
- TE file on disk `26363476151` bytes = dep `bytes` (`h3-qwen3vl-32b-clip`); failing offset+size
  is inside the file. Not a damaged download.
- Upstream (web search only, issues not read in full): `HostBuffer.read_file_slice failed` /
  aimdo-on-Windows failures in Comfy-Org/ComfyUI #14250, #15337, #15352, with
  `--disable-dynamic-vram` or `--disable-pinned-memory` as the workarounds; no aimdo fix found.
- `node --test tests/dynamic-vram-fallback.test.cjs` 5/5, incl. the verbatim line.

## Not verified

No live re-run of the H3 ref2v (it is Fabio's engine and a ~2 min GPU run). The next H3 run
after this fault restarts the engine with dynamic VRAM off; the failed run itself still fails.

## Open

The H3 ref2v graph stages the 25 GB text encoder TWICE per run, doubling the reads that hit this
fault; not investigated here.
