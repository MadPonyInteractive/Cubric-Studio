# MPI-1309 validation

## Bench 1: wording only, Fabio's robot-crew panel 1 (2026-10-27, Storyboard Improvements 4)

Setup: FLUX.3 Klein edit, Turbo, 1K 16:9, isolated instance (local RTX 4060 Ti, no paid calls), the exact
references Fabio's panel 1 got: 5 Character Sheets from Images (flowCSFI_009..013, each robot 3 times: front,
back, close-up) + drawn Film Set (t2i_011) + Clapperboard (t2i_012). Seeds 101/202/303/404. Project
"MPI-1309 sheet bench" (in Fabio's Documents\Cubric Studio\Projects; bench script and contact sheets in
the session scratchpad `bench/`). The prompt the app sent was CORRECT (5 named, 5 pictures, headcount line):
`panelsWithDrawn` rerun on his saved plan.

| Variant | Exactly 5 robots | Fault |
|---|---|---|
| A today's text ("X is the writer from image 2" + headcount) | 0/4 (edit_001-004) | extra copy, back-view twin, Prism/Cosmo twice |
| B "X is the writer from image 2, a character sheet showing X alone from several sides" + "each one drawn only once" | 1/4 (005,006,008,010) | Prism twice |
| C BFL ordinals ("the second image") + "The first five images are character sheets: each one shows a single character from several sides, not several characters." | 0/4 (012,014-016) | Prism twice, back-view twin |
| D C + "Each character keeps exactly the build and proportions its sheet shows: head size, body, arm and leg length..." | 1/4 (007,009,011,013) | Prism twice |

Counts from 800 px contact sheets, +-1. Conclusion: no wording stops it; ~15 robot figures across the
references beat one sentence. Prism (camera head, in a scene full of cameras) duplicates most. Leg length
(Fabio's report) was mostly short in these runs; D did not visibly change it.

## Bench 2: Qwen-Image 2.1 edit, same panel (2026-10-27, Storyboard Improvements 5)

Same 7 references uncropped, bench 1's D wording in Qwen's voice (`<image1>`..`<image7>` tags), 1K 16:9,
seeds 101-404, ~100 s each (edit_021-024 in the bench project).

| Model | Exactly 5 robots | Fault |
|---|---|---|
| Qwen-Image 2.1 edit | 0/4 | 7-8 robots every seed, Prism 3-4 times, parts mixed across robots (Prism eye + Vinyl headphones), back-view twins, Lingo missing in 3/4 |

Worse than FLUX.3. The front+back crop arm (edit_017-020) is WITHDRAWN: Fabio 2026-10-27, never crop a
character sheet, not even to test; the views beyond the front give the model each character's depth.
Wording (bench 1), a different model (bench 2) and cropping are all out: the fix has to change how the
panel is drawn.

## Landed (tests pass, not live-checked)

- `withModelGuide` (flowEnhance.js): the Storyboard planner's system prompt gets the picked panel model's
  recipe `t2v` structureOrder + donts at the `{{modelGuide}}` marker (flowsRegistry STORYBOARD_PLAN_ENHANCE_PARAMS).
- "Several characters" switch per picture in step 2 (MpiBaseFlow `_buildPictureNotes`, MpiButton toggle,
  icon `layers` - look is Fabio's call); note value `{ text, several: true }`; sentence
  "Picture N has several characters in it." (`pictureSentences` / `readPictureSentences` round-trip).
- Tests: storyboard-runner (model guide), flow-describe (switch round-trip). 85/85 in the five related files, eslint clean.
- NOT yet: the runner does not read the switch or name pictures per model (ordinal for FLUX.3) - waits on bench 2.
