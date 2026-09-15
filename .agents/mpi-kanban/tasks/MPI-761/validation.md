# MPI-761 validation

All runs in the release-line worktree `C:/AI/Mpi/Cubric-Vision-1.4.x`, branch `1.4.2`, base `a9f3a85b`.

## Premise checks (before editing)

- `grep -rl LanPaint_KSampler comfy_workflows` on 1.4.2: klein_t2i, klein_9b_t2i, krea2_t2i_sfw,
  krea2_t2i_nsfw, t2i_sdxl_realistic, t2i_sdxl_nsfw, t2i_pony_mix, t2i_ill_anime,
  t2i_ill_anime_beauty. That's all nine, as the brief says.
- `git show v1.5.0:js/data/commandRegistry.js`: old copy present (2 matches for "can NOT see" /
  "Leave the prompt EMPTY"). Neither file changed between `v1.5.0` and `a9f3a85b`.
- Nothing on 1.4.2 reads `promptRequired` except the test (grep), so the flip to `true` is
  metadata only, same as on master.
- Gate 0 for the notes bullet: `klein_t2i.json` has 0 LanPaint nodes at `v1.4.4`, 1 at `v1.5.0`,
  so "since 1.5.0" is accurate.

## Port

- Cherry-pick not used: 1.4.2's inpaint `components` comment already carries the post-fix wording
  plus `krea2Turbo` (MPI-706 port), so that hunk conflicts. Ported by hand.
- The ported Detail comment/body and Inpaint comment/`info`/help block were extracted from both the
  worktree and `c7493555` and diffed: identical (Detail compared with blank lines stripped, since
  master's copy has a stray empty line inside the comment).
- `docs/releases/UNRELEASED.md`: Gate-0 comment + `## Fixes` bullet, no em dashes.

## Checks - PASSED 2026-09-15

- `npm test` (worktree): 674 pass / 0 fail.
- `node --test tests/op-strip-availability.test.cjs`: 20 pass / 0 fail.
- `npx eslint js/data/commandRegistry.js tests/op-strip-availability.test.cjs`: exit 0.
- Old-copy grep on the worktree registry: 0.

- `npm run release:check` (worktree): passed.

## Claim audit (mpi-end-session, claim-auditor) - 18/18 PROVEN

- 17 proven by the auditor, including: exactly nine models declare `inpaint` at v1.5.0
  (sdxl-realistic, sdxl-nsfw, ill-anime, ill-anime-beauty, pony-mix, krea2, krea2-nsfw,
  klein-4b, klein-9b), each workflow carrying one `LanPaint_KSampler`; ReferenceLatent present in
  v1.5.0 klein_t2i; `promptRequired` gated by nothing (only declarations + a comment in
  flowsRegistry.js).
- 1 left UNPROVEN by the auditor, then proven by hand: the ported comment "the bare word
  'remove' ... was what the app used to inject on an empty prompt". v1.4.4 `klein_t2i.json`
  node 367 `MpiString "Remove"` -> 381 `MpiIfElse` (true branch) -> 642 `MpiBlocker` -> 380
  `StringConcatenate` after "Fill the green spaces according to the image. ". Gone at v1.5.0.

## Shipped

- `fb7ee5cf` on `1.4.2` (3 files: registry, test, UNRELEASED.md), pushed `a9f3a85b..fb7ee5cf`.
  `dev_configs/smoke-run.txt` was also modified in that worktree; not this card's, left out.
