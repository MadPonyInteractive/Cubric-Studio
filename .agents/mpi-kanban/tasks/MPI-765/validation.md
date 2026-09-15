# MPI-765 Validation

## Unit

- `tests/agent-generation-relay.test.cjs`, four new tests: the route relays `media` on the
  modelId branch and a text submit carries no `media` key; declared slot order; the
  `BAD_REQUEST` cases (unknown role, no url, role twice); required slot filled by role.
- Connector suites 40/40, `npm test` 1045/1045, eslint clean on the changed files.
- Slot-order test proven to bite: `mediaItems.sort` removed, the test fails; restored.

## Live, in the user's app (restarted on 435fa5cc), 2026-09-15 ~13:00 UTC, GPU lease held

Project "Cubric Studio Mascots", `klein-9b` / `kleinEdit`, `styleSelect: 0`, roll 1 prompt
read verbatim from MadPony-Identity `production/cubric-mascots/sheets/vision.md`. Both
plates staged with `place-preview-asset` (content-addressed, sha 3180… plate, 71b5… ref).

| Probe | Result |
|---|---|
| role `image1` | `BAD_REQUEST`, lists `inputImage, inputImage2, inputImage3` |
| `inpaint` with an image | `MASK_UNSUPPORTED` |
| lone `inputImage2` | **ok:true, `edit_001.png` 1024x1024: the reference was edited. Bug, below.** |
| real roll, `inputImage2` sent BEFORE `inputImage` | ok:true, `edit_002.png` 1296x816 (8:5, the plate's shape), 21.8 s. Sidecar `mediaItems`: `inputImage` = plate, `inputImage2` = ref |

## Bug found live, fixed in the follow-up commit

`findMissingMediaSlot` (shared with the PromptBox) accepts any item of a required slot's
type. On the agent path that let a lone `inputImage2` through, and ordinal injection made
it Image 1. `resolveAgentMedia` now requires each required slot by role and returns
`MEDIA_REQUIRED`. Unit-tested; the pre-fix resolver had no required-slot check at all,
and the live probe above is its ok:true.

Not re-run live: the fix is renderer-only, and the running app picks it up on a reload
(Ctrl+R), not before.

## Left behind

- `edit_001.png`, a junk card in "Cubric Studio Mascots" from the probe. The user deletes it.
- `edit_002.png` is roll 1 for MadPony-Identity MPI-78. The judgement is Fabio's.
