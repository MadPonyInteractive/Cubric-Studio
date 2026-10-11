# MPI-1084 Validation

Baseline (MPI-1060, 2026-10-11): --ref-tiers 9/12; medium tier mislabels Picture 2 (room -> "a rocking chair") while passing every check.

## Step 1: failures visible to the sweep (2026-10-11)

- Harness `scripts/recipe-test.mjs` `runChecks`: new `picture role` check. Role read off the input's own words before
  each tag ("in/at/inside" = setting, "wearing/holding/carrying" = prop); fires only when an output line starts with
  that tag, so Wan/Seedance (no picture lines) never see it.
- Recipe r2v `forbiddenPatterns`: the bare-tag ban replaced by a thin-line floor (<5 words after tag + role word).
  The old `<Picture \d+>\s*$` only matched at the END of the output (patterns compile without the m flag).
- Offline self-check (scratchpad check.mjs): the bad output trips both checks, a correct one trips none.
- Live, CURRENT wording, `--tier medium --runs 3` under gpu_lease: **0/3**. Every run: `[XX] forbidden: thin line
  FOUND: <Picture 1> a man` and `[XX] picture role: <Picture 2> is a setting: <Picture 2> a rocking chair`. The old
  sweep passed this same output.
- `node --test tests/recipe-registry.test.cjs tests/agent-corpus.test.cjs`: 2/2 pass.

## Step 2: wording (2026-10-11), gemma-4-abliterated-12b, judge gemma-3-12b, 3 runs/tier, gpu_lease

| Sweep | Wording | Result | What failed |
|---|---|---|---|
| medium only | role rule + 6-word description rule + worked example | 3/3 | - |
| full A | same | 7/12 | overlong `<Audio 1>` line 3/3; directed `<Picture 1> prop: the cowboy's hat` 1/3 (Picture 1 default dropped); bare `a cat` 1/3 |
| full B | + untagged Picture 1 = main subject, cue must touch the tag, cat example, audio in example | 9/12 | overlong `<Audio 1>` line 3/3 |
| overlong only | + "PICTURES ONLY" bullet first, Output line "never an <Audio n> line" | 0/3 | `<Audio 1>` line 3/3 |
| overlong only | + the literal Attached-references line -> two lines example | 2/3 | `<Audio 1>` line 1/3 |

Full B picture lines (all roles right): bare `the cat, the main subject at the centre of the scene` x3; medium Picture 2
`setting: the room with the fireplace where the man sits` (and two variants), Picture 1 `the man, the main character
of the scene` (copied the example's stock phrase; example reworded after); directed `the cowboy wearing a hat, the main
character of the scene` x3. The scene places `<Audio 1>` in the audio sentence in every overlong run, failures included.
Audio reaches LTX through its own input slot (docs/models/ltx/audio-input.md), not the prompt text.

## Sheet builder drops `<Audio n>` lines (Fabio: "yes, make the sheet builder skip it", 2026-10-11)

- `routes/ingredientsSheet.js` `parseSheetPrompt` skips a line starting with `<Audio n>`; test in
  `tests/ingredients-sheet.test.cjs` failed first, passes now (13/13 with recipe-registry + agent-corpus).
- Recipe's `<Audio n>`-line forbiddenPattern removed (harmless now); harness gains `<Audio n> in the scene`: the tag
  must sit on a line that does not start with it (self-check: lost tag fails, kept tag passes).
- Full C: **12/12 ALL PASS**. Full D: 10/12: medium `<Picture 1> the man` (thin) 1/3; overlong scene wrote "his own
  voice as he speaks" and lost `<Audio 1>` 1/3 (new check caught it). Also seen: `the man, the main subject of the
  scene` (padding copied from the cat example instead of the user's words). Wording fixed: sentence 6 must carry the
  tag; "the main subject" only for a picture the user says nothing else about (dog example, not the test text).
- That wording REGRESSED: full E 10/12, full F 7/12. The literal `("he speaks in the voice of <Audio 1>")` in sentence
  6 was copied into `directed` (no audio attached): `added: <Audio 1>` 3/6, one run a 3590-word runaway. Medium
  `<Picture 1> the man` 3/6 (the "main subject" padding gone, nothing in its place). Fixed: sentence 6 names no
  literal tag, keys on the Attached line; a "the X who/that/where ..." PATTERN line replaces the padding rule.

- Full G (PATTERN line, no literal tag in sentence 6): 10/12. Every picture line right (medium lifts "who sits in
  the rocking chair", overlong 3/3 with no `<Audio 1>` line), but directed `added: <Audio 1>` 2/3 again: the sentence-6
  audio clause itself plants the tag (it also gave Fabio's live Enhance "She speaks in the voice of none"). Clause
  removed; PART 1's "With no real <Audio n> tag, write none" reworded so "none" cannot be copied. Sweep H killed.

## Reference to Video on a RunPod Pod (dev build, 2026-10-11)

First Pod run of `ref2v_ms` (MPI-1060 had only local runs). Fabio's dev app, Pod RTX PRO 4500 (EU-RO-1, volume
`cubric-vision-EU-RO-1`), sent through the cubric-studio MCP `generate`: `ltx-23-balanced` `ref2v_ms`, 16:9 medium
(960x512), 5 s, Picture 1 = cowboy character sheet, Picture 2 = forest path; hand-written r2v-shape prompt. No
missing-files prompt. Card `ref2v_001.mp4` in project "X2.3 references": the cowboy keeps the sheet's hat, red
neckerchief, vest, coat and holster; the forest path is the setting; the hat-brim beat and the walk land; one person,
no collage, no split screen. Fabio: "It's okay. His face is a bit messed up, but I think that's just because of the
low resolution."

Close-up at high (1216x704), same pictures, `ref2v_002.mp4`: costume, hat, neckerchief, age and hair hold; the FACE
is a different person. Fabio: "identity is pretty bad. That's not the same guy." Not resolution. Not this card's
(prompt wording); identity work is MPI-1096 (research: identity LoRAs for ref2v AND i2v).
Sheet ONLY (`ref2v_003`, desert close-up, high): sheet passes untouched. Fabio, side by side with the sheet: "the same
guy this time around" (face a bit wider, lens). So the face drifts when it shares the sheet with a setting. Recorded
on MPI-1096.
