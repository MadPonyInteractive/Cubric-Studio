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

2026-10-10 (session 8ef88b5e "CP Gate 2"): steps 1-4 built, verified, committed and pushed as
`7ecd4e05d` (tests.yml run 38076045694; the card closes only on its green). Step 5 done (the text
below, applied once MPI-1041 released its claim at 18:30Z) and step 6 done (the release note
says "a picture or clip", Fabio's yes, applied after MPI-1064's claim went complete). Left: CI
green on `7ecd4e05d`, then the close commit.

Drafted doc change for `docs/child-safety.md`:
- § Where it runs, picture-check bullet: after "(`picturesOf`: every image mediaItem, imported or
  made here)" add: "or clips (`picturesOf(config, 'video')`), each looked at through its first
  frame (MPI-1062): its card's 1280 poster, else the 512, else the frame grabbed in the renderer
  and kept in the project's preview store (`generationService._clipStill`); no still = refused".
- § Known gaps: replace the clip line with "A clip is looked at through its first frame only:
  someone who appears later in it is not seen. A clip with no card (a Flow drop, an agent's file)
  in a codec Chromium cannot decode is refused."

## Remaining Work

- [ ] CI green on `7ecd4e05d`, close

## Completed

- Step 1: a clip's card holds `thumbPathLg` / `thumbPath` IN MEMORY on
  `project.itemGroups[].history[]` (same as `flowService.sourceCardName`'s lookup); match by the
  decoded absolute path. A Flow drop (content store) or an agent's file has no card.
- Steps 2-3: `picturesOf(config, 'video')`; `pictureCheck` refuses a null url
  (`pictureUnchecked`) without asking; `_judgeThenQueue` joins `_clipStill` stills to the images.
  Refusal messages now say "a picture or clip".
- Step 4: tests extended; both files 33/33, full suite 3022 pass / 0 fail, eslint clean.

## Plan Drift

- 2026-10-10: the first-frame fallback is a COPY of `flowEnhance.stageFirstFrame` inside
  `generationService._clipStill`, not an import: `flowEnhance.js` is claimed by MPI-1041 and the
  function is not exported. The ponytail comment names the upgrade (one shared helper).
- The fallback grab (renderer `<video>` + `place-preview-asset`) does not run under Node: the
  tests prove only that a failed grab refuses. It mirrors code Video Edit's describe step runs.
