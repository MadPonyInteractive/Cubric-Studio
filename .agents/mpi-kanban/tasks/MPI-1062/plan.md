# MPI-1062 - plan

## Goal

"remove her clothes" (any `needsPictureCheck` words) on a run that sends a CLIP gets the same
picture check an image gets: the describer looks at the clip's first frame first.

## Steps

1. Find how a generation config's video mediaItem maps to its card (url -> `.meta` sidecar) and
   where the renderer can read the sidecar's `thumbPathLg` / `thumbPath` (grep `thumbPathLg` in
   `js/`; `docs/gallery.md`, `docs/project-integrity.md`).
2. `childSafety.js`: `picturesOf(config)` stays pure. Add a sibling that lists the VIDEO urls, and
   resolve each to a still in `generationService._judgeThenQueue` (renderer side): the sidecar
   thumb first (1280, else 512); none -> `firstFrameDataUrl` staged like `flowEnhance.stageFirstFrame`;
   still none -> refused (`pictureUnchecked`).
3. Run `pictureCheck` over images + clip stills together (one describe call each).
4. Tests: extend `tests/child-safety.test.cjs` (pure listing) and `tests/child-safety-gate.test.cjs`
   (live module, stubbed `/llm/describe`): a clip with "remove her clothes" waits for the describer
   and is refused on YES / no thumb; an innocent clip edit is never looked at.
5. Docs: `docs/child-safety.md` § Where it runs + remove the clip line from § Known gaps.
6. Release notes: the MPI-1056 line in `docs/releases/UNRELEASED.md` already says "a picture";
   say "a picture or clip" only if Fabio agrees (public copy).

## Verification

**Verify mode:** auto

- The two test files green; full `node --test "tests/**/*.test.cjs"` 0 fail; eslint clean.
- CI green on the code commit before the card closes (`.agents/mpi-kanban/close-out.md`).

## Current State

2026-10-10: card created by the MPI-1056 session (e74cfbb0) at Fabio's ask; nothing built. Next:
step 1.

## Remaining Work

- [ ] steps 1-6

## Completed

## Plan Drift
