# MPI-821 — validation

**Closed 2026-09-19.** All four parts shipped. Fabio verified in the running app:
*"everything looks great and awesome"* — that was the one user-ux gate the card was
holding for.

## Commits

| commit | what |
|---|---|
| `0302aefb` | parts 1, 2, 4 — Archive next to Delete, the third dialog action, Cleanup repointed at the derivatives |
| `0693c520` | part 3 (narrow) — Reuse points at the source card; the menu becomes three separated groups; right-click Delete confirms |
| `598aef28` | card → `validating` |

## CI

`gh run watch 35440996139` on `0693c520`, the card's own code commit — **success**,
`npm test` and `npm run test:desktop` both green on the runner. A card does not close on a
red run of its own commit (`.agents/mpi-kanban/close-out.md`); this one is not red.

## Evidence

| claim | proof |
|---|---|
| Derivatives are dropped, masters and `<id>.splat.ply` kept, sidecar fields nulled, idempotent | `node --test tests/cleanup-derivatives.test.cjs` — 3 pass |
| A preview snapshot is a REFERENCE: no `filePath`, the store is not even created, `frozenParams` comes back as the SAME object, and `placeContentAsset` still serves cardless files | `node --test tests/reuse-refs-not-copies.test.cjs` — 3 pass |
| The menu is the exact three-group order with both separators and no silent row; right-click Delete opens the confirm with the card still on screen; Enter confirms Delete, not Archive | `tests/desktop/delete-offers-archive.spec.js` — 3 pass |
| The neighbours of the re-ordered menu still work | `tests/desktop/gallery-archive.spec.js` (3) + `gallery-cue-all.spec.js` (1) |
| Nothing else regressed | `npm test` — 1386 pass, 0 fail, 1 skipped |
| No lint debt added | eslint clean on every touched file (also enforced by the pre-commit hook on all three commits) |

## What this card decided, and what it gives up

**Fabio, 2026-09-19 — NARROW scope.** `.preview-assets` stops being a reuse store and stays
a STAGING store.

- **Gone:** `materializeGenerationFrameSnapshots` and `_snapshotRoleForMediaItem`, with their
  call sites in `save-generation` and `/extend-video`.
- **Kept:** `placeContentAsset`, `POST /place-preview-asset`, `migratePreviewAssetsStore`.
  The agent's `placeAsset` and a Flow's OS-file drop have **no gallery card**, so Archive
  cannot cover them — and they are a published contract in three skills, `docs/agent-chat.md`
  and `routes/connector.js`.
- **Given up on purpose:** reusing the inputs of a card whose SOURCE card was deleted. That is
  the MPI-225 fix reversed deliberately — Archive, not a hidden copy, is how a user keeps a
  source around, which is why the delete confirm now offers it and the context menu puts it
  directly above Delete. `resolvePromptReuseMediaItems` HEADs every url, so the failure mode is
  a toast, never a broken chip.
- **Existing sidecars:** left alone, no migration. Every reader takes `filePath || url`.

## The two traps this card had to find

1. **`/backfill-media-derivatives` gates on the SIDECAR, never on disk** (`if (meta.thumbPath)
   continue`). A Cleanup that deleted the files without nulling the fields would make the
   rebuild skip that item **forever** — and a video card has no `filePath` fallback, so it
   would be a blank grey tile for the life of the project.
2. **`GET /validate-preview-assets` built its candidates from `filePath`/`relativePath`/
   `filename` only.** Every newly written snapshot would have read as `missing` →
   `canColdFallback: false` → a multi-stage **Continue BLOCKED** with everything it needed on
   disk. Found by reading the consumer, not by a test failing.

A third, avoided: `DERIVATIVE_RE` matches `<id>.splat.ply`, which is a **master** (the still
is rendered FROM it), so Cleanup carries its own narrower `CLEANUP_DERIVATIVE_RE`.

## Accepted regression, stated

The server-side positional role fallback went with the copier. It only ever covered role-LESS
chips, and `MpiPromptBox._withAssignedRoles` fills every declared slot by `mediaType` before a
generation is dispatched, so nothing generated through the PromptBox produces one.

## Durable homes

- `docs/project-integrity.md` § `previewAssets` — what the store is for now, the reference
  shape, and why a deleted source card takes its inputs with it.
- `docs/gallery.md` § "The rendition ladder" — Cleanup, the sidecar-gated backfill trap, the
  `.splat.ply` trap.
- `docs/data.md` — role assignment is `MpiPromptBox._withAssignedRoles`, not the deleted
  server helper.
- `.claude/rules/dos_and_donts.md` § "Context menus" — the three-group shape and the
  every-row-`info` rule, added with Fabio's explicit permission.

## Claim audit (`mpi-kanban:claim-auditor`, 2026-09-19)

Ran read-only over this card's plan, checklist and both commit bodies. **34 claims PROVEN**
against code on disk. Two other results, both actioned:

- **OVERSTATED — fixed.** `docs/data.md` was listed as "updated", but only line 81 had been.
  The "Reuse prompt recall" entry at **line 87** still said snapshots are read from
  `previewAssets.snapshots[].filePath` pointing at the flat store, and that
  "Preview-assets are PERMANENT" in a reuse context — both wrong for any sidecar written
  since this card shipped. Re-checked by hand against `routes/projects.js` and
  `js/utils/promptReuse.js:73,81`, then healed: line 87 now says `filePath || url`, names
  `filePath` as the legacy half, and says a reuse resolves against the SOURCE CARD.
- **UNPROVEN — accepted.** The three Playwright desktop specs (3 + 3 + 1) could not be
  re-executed by the auditor: `.spec.js` files are excluded from `npm test`, which runs only
  `*.test.cjs`. They were run by hand this session (all pass) and again by CI run
  35440996139 on `0693c520` through `npm run test:desktop`, which returned success.

The auditor independently re-ran `npm test`: **1386 pass, 0 fail, 1 skipped** — the count this
card claims.

## Not done here

- ~~`docs/releases/UNRELEASED.md` carries no entry yet.~~ **Done** — Fabio approved the draft
  at close-out and it landed: three bullets under **Important changes** (the delete confirm,
  the Reuse behaviour change, Cleanup as the slim-a-project-down step) and one under
  **What's new** (the reorganised menu). Entries were owed because Archive, Reuse Prompt and
  "Cleanup assets…" all shipped in 1.5.0 or earlier — a change to an unreleased thing owes
  none.
- **The board is red at HEAD and it is not this card's.** 21 violations, all legacy-shaped
  event lines under `MPI-771` (`tasks/MPI-771/events.jsonl:26-30` and their mirrors in the
  global log at `:4592,4593,4594,4598,4608`), written by `implementer:7bbff4d4`. MPI-771 was
  live in another session, so nothing here touched it.
- **`npm run release:check` fails on pre-existing drift** — missing archival notes for 1.6.0
  and 1.6.1, and `smoke-evidence.json` stale since the engine pin moved 0.31.0 → 0.34.0 on
  2026-09-17. Nothing from this card; belongs to `/mpi-version-bump` or `/mpi-bump-engine`.
