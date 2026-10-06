# MPI-1029 validation

> **REVERTED 2026-10-06 (Fabio): nothing below is live.** The fallback extension cost the whole
> session 1.3-1.65x after one H3 read error. Plan now: checklist.md section Next.

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

## One-clear graph fix (2026-10-06, session adddc00f)

- Runtime `comfy_workflows/minimax_h3_r2va.json` regenerated from Fabio's raw template. Semantic
  diff vs HEAD: #765/#766 removed; #873 packer, #875 clear, #877/#879 unpackers added; #562/#565/
  #597 rewired through them; #331/#332/#346 `force_rate` 0 -> 24. Nothing else.
- `node scripts/validate-injection-rules.mjs comfy_workflows/minimax_h3_r2va.json` - conforms.
- `node --test` inject-never-clobbers-link, inject-params-titles, in-graph-enhance,
  h3-two-pass-dimensions - 104/104 pass.
- Pinned MpiNodes `bc92a1b8` ships `MpiPacker`/`MpiUnpacker` (added in 69a4333).
- Live proof (Fabio, source run, app restarted 08:37Z, log read from byte 190532): two H3 ref2v
  runs with image + video refs - 08:39:15Z (`Prompt executed in 401.30 seconds`) and 08:53:09Z
  (past both encodes into sampling at time of reading). Zero aimdo / `read_file_slice` lines.
- The tell is `Requested to load MiniMaxH3TEModel_`, NOT the `25140MB Staged` line (that one
  logs on EVERY forward, loaded or not - the handoff's "Staged ONCE" check was wrong). Old graph:
  `Requested to load` before BOTH encodes in every run (06:59:19 + 07:00:12, 07:32:44 + 07:33:33),
  i.e. the clear evicted the encoder and the second encode re-read it. New graph: once per
  prompt (08:39:56 only; 08:53:35 only) - the encoder stayed loaded across the second encode.
  Second TE pass 18.8 s / 16.2 s.
- Shipped 3e7ae7dad; CI Tests run 37439820138 - success. Release session (MPI-1026) told 2.0.1
  is unblocked.
- Reopened for the doc only (Fabio's yes): 8aca67958 adds the rule + log tell to
  `docs/models/h3/performance.md` (187 lines, under budget). Docs-only, no code.
