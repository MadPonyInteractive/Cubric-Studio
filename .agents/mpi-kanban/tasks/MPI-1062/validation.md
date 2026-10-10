# MPI-1062 validation

## 2026-10-10, session 8ef88b5e (code, uncommitted)

- `node --test tests/child-safety.test.cjs tests/child-safety-gate.test.cjs`: 33 pass, 0 fail.
  New: a clip with "remove her clothes" waits for the describer, which is handed the card's 1280
  poster; queued on NO; refused on YES; a clip with no card (the renderer grab cannot run under
  Node) is refused with "could not run" and the describer is never asked; an innocent clip edit
  ("make it night") queues at once with no describe call. `picturesOf(run, 'video')` lists each
  clip once; `pictureCheck([..., null])` refuses without asking.
- `node --test "tests/**/*.test.cjs"`: 3024 tests, 3022 pass, 0 fail.
- `npx eslint js/data/childSafety.js js/services/generationService.js`: clean.
- Not run live: the renderer first-frame grab for a clip with no card (copy of
  `flowEnhance.stageFirstFrame`, which Video Edit's describe step already runs).

Code committed `7ecd4e05d`, pushed; tests.yml run 38076045694.
Docs (`docs/child-safety.md` § Where it runs + § Known gaps) committed separately.

Release note: the MPI-1056 bullet now reads "in a picture or clip" (Fabio's yes, 2026-10-10).

CI: tests.yml run 38076045694 on `7ecd4e05d` completed success. Card closed on that evidence.

## 2026-10-10, Fabio's live check (dev app, project "CP Tests")

Video Edit, "Change the background", prompt `背景を夜の街にする` (innocent words in a script the lists
cannot read, so the picture check runs and a failed gate would only make a night city), a stock
clip of a clothed child (`imported_002.mp4`, 2160x3840, 59.9 fps):
- Card path: two runs on gallery cards (`videoCrop_001` / `videoCrop_002`) refused, `app.log`
  19:55:31Z and 19:56:04Z `[childSafety] refused a user run of flowVideoEdit (picture)`.
- No-card path (the one Node cannot run): the clip dropped from Explorer landed in the content
  store (`Media/.preview-assets/9049559a...mp4`, sha256 = `imported_002.mp4`), the renderer grabbed
  frame 0 (`.preview-assets/615ae891...png`, 11 MB, written 19:57:52Z) and the run was refused at
  19:57:53Z `(picture)`. Toast: "Refused: ... on a picture or clip that may show someone under 18".
- Adult clip (a woman walking, 1080x1920, dropped from Downloads, no card): stored as
  `.preview-assets/244d3b75...mp4`, frame 0 grabbed (`b551fad7...png`, 20:01:30Z), describer NO (no
  refusal), judge `[childSafety] judge on endpoint (google/gemma-3-12b-it) answered ALLOW`
  20:01:32.814Z, ComfyUI `got prompt` 20:01:32.883Z: queued and generating. Fabio stopped it.
- Found by the test (Fabio): a non-Latin prompt with innocent words on a picture or clip of a
  CHILD is refused, because the look asks only "could anyone be under 18", not what the words ask.
  An English speaker's same edit is never looked at. Pre-existing since MPI-1056, images too.
