# MPI-1119 - Cosmo can explain the 3D Scene workspace

Fabio, 2026-10-12: Cosmo does not need to make paths; he needs to explain the workspace when a
user asks ("what's this workspace, what are these paths, how do I use this?"). Explanation, not
new tools.

## Gaps found

- No `docs/agent/` guide mentions 3D Scenes, paths, the 360 player, Take picture or Convert to
  360 video (only `flows.md` § 360 Panorama names Convert to 360 pano).
- On the Scene page the App state line (`services/agentLoop.mjs` `_appStateLine`) says the user
  is "looking at the card" and to use "the Mask tool from the toolbar down the left": the
  history-view wording. The client already sends `workspace.page === 'scene'`; the server ignores it.
- Stale "dev" labels: `docs/README.md` 3D Scenes row, `docs/scenes.md:176`.

## Steps

1. `docs/agent/3d-scenes.md` (auto-listed as `app:3d-scenes`) -> verify: corpus lists it.
2. Scene-page branch in `_appStateLine` (pano scene vs path-video player) -> verify: unit test.
3. `flows.md` 360 Panorama: pointer to app:3d-scenes.
4. Stale labels.

## Verification

**Verify mode:** auto

`npm test` green; a test asserts the Scene-page line names app:3d-scenes and drops the Mask tool.

## Current State

Steps 1-4 built and green (validation.md). Commit with the card in doing, close once CI passes.

## Completed

- Steps 1-4 (2026-10-12).

## Remaining Work

CI on the code commit, then the close commit.

## Plan Drift
