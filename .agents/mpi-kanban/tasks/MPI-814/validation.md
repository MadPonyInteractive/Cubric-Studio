# MPI-814 Validation

**Closed 2026-09-19.** Fabio read the file and said close it.

## Shipped

| commit | what |
|---|---|
| `67a79c6d` | the rule, its two pointers, and the MPI-811 bullet cut to size |
| `dbbc1475` | `UNRELEASED.md` cut to the standard — 657 → 256 lines |

## The rule, and why it lives where it does

`docs/releases/README.md` § Content → "Length", beside the existing "Voice" rule. One home:
that file already owns release-note conventions, and CLAUDE.md forbids a catch-all gotchas
file. One or two lines per bullet, what it is and why the reader cares. The list of what
never goes in is the operative half — key mappings, what the feature used to do, the bug
behind the fix, component names, card ids. Fabio's own radial sentence is the worked example.

Pointers, not copies, at the two moments an agent is writing:
- `UNRELEASED.md`'s header — anyone adding a bullet mid-cycle.
- `.claude/skills/mpi-release/references/copy-review.md` Gate 1 — release time.

**Gate 1 is where this failed before.** It already said "the user rewrites the copy", which is
how the monster grew: the agent drafted long and handed Fabio the trimming. The new line says
cut it BEFORE showing him. `mpi-version-bump` Step 5 gets the matching line — folding the
scratchpad into `releaseNotes.js` is cutting, not copying.

## The cut

Nothing dropped. 33 fixes → 33, 8 important changes → 8, 22 what's-new → 22 (counted per
section against `67a79c6d`). One structural change: the fourteen per-flow entries, several of
them three paragraphs with their own sub-sections, fold into the fourteen one-liners already
inside the Flows bullet. Fabio's 2026-08-26 header note moved from "every flow gets its own
ENTRY" to "its own LINE" so the next fold does not re-expand them — flagged to him, not
changed silently.

The `§ Fixes` note was resolved early rather than at fold time: the latent-preview entry named
the Flow result pane, which that note said to drop because no released build had the bug.

## Deliberately NOT done

`js/data/releaseNotes.js` and the archival `docs/releases/2026-*.md` for 1.3.x / 1.4.x are
untouched. Users have read those; rewriting them rewrites history. The rule applies from the
next release forward. Raised with Fabio, who left it there.

## Note for whoever folds 2.0

`npm run release:check` currently fails for reasons that predate this card — no archival
markdown for 1.6.0 / 1.6.1, and `smoke-evidence.json` stale against the 0.31.0 → 0.34.0 engine
pin. Not caused by prose edits; the gate does not read bullet text.
