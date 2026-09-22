# MPI-887 Checklist

Bring an outside image into a card's history as an entry, so Composite can reach it.

- [x] 1. `routes/projects.js` — lifted the per-card copy body out of `add-from-cards` into
      `copyItemIntoProject()` (media + cloned sidecar + thumb / large / proxy / splat /
      gif-frames) and added `POST /project-media/:projectId/copy-item`, which returns the
      copied item's fields through `copiedItemResponse()` and writes NO project.json.
      **Verified:** `node --test tests/project-copy-item.test.cjs` — 3/3.
- [x] 2. `MpiMediaPicker` — `toHistoryLabel` renders an **Add to history** toggle in a new
      `#dest-slot` in the head: a toggleable `MpiButton`, the same ghost icon+label shape
      as the FILTER button beside it. It was an `MpiCheckbox` switch first and Fabio
      rejected it on sight (2026-09-22) - a form switch read as a settings row dropped
      into a row of picker controls; `toHistory` rides both the `pick` and `import` payloads, and
      `pick` now carries the source `item` whole so an opener that must copy has its id and
      renditions. No prop, no toggle.
      **Verified:** desktop spec, "an opener with one destination gets no toggle".
- [x] 3. `MpiPromptBox` — passes the label only where `stageMedia` is on, and emits
      `stage-to-history` instead of staging. An import with the flag set skips
      `media:imported`, which is what would otherwise build a second gallery card.
      **Verified:** desktop spec, "an imported file lands as an entry too, and makes no
      second gallery card" — driven through the upload card's real file input.
- [x] 4. `MpiGroupHistoryBlock._addPickedEntry` — copies (pick) or takes the upload straight
      (import), then the existing recipe: `appendToHistory` → `_setCurrentIdx` →
      `_persistGroup` → `historyList.el.appendEntry` → `history:stats-dirty` →
      `viewer.el.loadEntry`.
      **Verified:** desktop spec, "the Add to history toggle turns a pick into a history
      entry on the open card, as a copy" — entry appended and selected, survives to project.json, its own file
      on disk, the source card's file and history untouched, sidecar prompt carried over.
- [x] 5. `js/components/types.js` — the new props typed. `docs/workspaces.md` — the image
      group's media contract now records the second destination.
- [x] 6. Fabio's own check in the app: **"The functionality worked, by the way"**
      (2026-09-22). His one change was the control itself, now step 2's toggle.
- [ ] 7. Fabio's look at the toggle in the app, replacing the switch he rejected.

## Verification

**Verify mode:** user-ux — steps 6 and 7 are the user’s eyes. Steps 1-5 self-verify.
