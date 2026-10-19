# MPI-1193 validation

(Evidence lands here as each gate passes.)

## 2026-10-19 01:15Z: route check, BLOCKED on a decision

- No upstream tag carries #17178 (latest v0.42.0; 7db08fe50 is the first commit after it, touches
  only `comfy/model_prefetch.py`).
- Fresh installs (Windows `.7z`, comfy-cli `--version`) and the Pod Dockerfile (`git clone --branch`)
  read the TAG only. The in-place upgrade reads `core.commit` but needs host git on Windows
  (`ensureGit` is Linux/mac only), and its failure falls back to a full reinstall of the TAG's
  portable. So a commit pin would leave most Windows users on v0.42.0 without the fix.
- Pin edits reverted in the working tree (they would have upgraded the shared dev engine on any
  `app:isolated` boot). Nothing committed.
- Options + pick: shared session note `engine-pin-7db08fe50-MPI-1193.md` (outside the repo).

## 2026-10-19 decision: ship 2.1 on 0.41.0 as is (Fabio)

"We'll just ship as it is." He cancelled six or seven runs in a row with no crash; the restart
is automatic (MPI-1192 ends the Stop as cancelled, the next run re-spawns the engine). The
0.41.0 smoke evidence stays valid. No pin change, nothing in the engine moved.
- Models whose sampler turns on the Comfy model compiler in 0.41 (the crash path, read from the
  engine source): Qwen-Image 2.1, LTX 2.3 + its Flows, MiniMax H3. Not SDXL, Chroma, Krea2,
  Klein, Wan 2.2, Qwen Edit.
- The fix rides the MOSS-Image engine bump: note added to MPI-1180's brief (take the first tag
  AFTER v0.42.0).
- Untried option on record: `--disable-comfy-compiler` would remove the crash path on 0.41 at
  an unmeasured speed cost.
- Side finding, not acted on: a git-less Windows user's in-place upgrade throws in `ensureGit`
  and falls back to the full reinstall (re-download portable + nodes + pip), so 2.0 -> 2.1
  takes the slow path for most Windows users.
