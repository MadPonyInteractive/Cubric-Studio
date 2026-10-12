# MPI-1084 - LTX 2.3 Reference to Video enhancer (recipe r2v): right picture roles, real descriptions, green Stage 1

## Current State

Project mode: scalable-foundation. Follow-up to MPI-1060 (closed 2026-10-11; the op, composer, start frame and
docs shipped). Fabio read a real sweep output and called it a fail; this card makes the `r2v` enhancer mode right.
Fabio: "If you need the GPU, then you'll get the GPU in the next session."

**The recipe:** `js/data/recipes/ltx-2.3.recipe.js`, mode `r2v` (status `draft`; only Fabio flips it). What it
must produce is decided (MPI-1060 D5): one `<Picture n> [role:] description` line per attached picture, a blank line,
then the seven-sentence LTX scene. The app (`routes/ingredientsSheet.js` `parseSheetPrompt` / `sheetRoles` /
`sheetPrompt`) turns the picture lines into `### Reference Sheet Description` with cell names and roles. A role or
description the enhancer gets wrong goes straight onto the sheet the IC-LoRA reads.

**Failures seen (MPI-1060 validation.md § Recipe r2v Stage 1; outputs in that session's scratchpad, gone):**
1. **Wrong role.** Input "The man from `<Picture 1>` sitting on a rocking chair in `<Picture 2>` ..." gave
   `<Picture 2> a rocking chair`. "in `<Picture n>`" names a PLACE: it should be `<Picture 2> setting: ...`.
   The deterministic checks and the judge both passed it, so the sweep cannot see this today.
2. **Thin descriptions.** `<Picture 1> a man`. The bench (MPI-1060 results.md § Phase 2b) showed two-word labels
   lose the prop. The enhancer cannot see pictures (text-only, `llmService.js` sends no image), and the draft
   forbids inventing appearance. Decide the line: lift every detail the user's text gives that picture (the
   scene's words about it, its role, what it does), and say what it IS in a full phrase, never invent looks.
3. **`<Audio 1>` given a picture line** (2 of 3 overlong runs) despite the rule; forbiddenPattern catches it.
4. **Word floor:** bare outputs at 77-78 words against `wordBudget.min` 80.
5. **Nothing attached** writes a `<Picture 1>` line: NOT this card. MPI-1081 makes Enhance use the t2v mode
   when nothing is attached; once it lands the plain `--mode r2v` sweep tests a case the app never sends.

**Harness:** `npm run recipe:test -- ltx-2.3 --mode r2v --ref-tiers --engine gemma-4-abliterated-12b --judge
gemma-3-12b --runs 3`, ALWAYS under `gpu_lease.py run --poll 2` (plugin `skills/mpi-lib/scripts/gpu_lease.py`),
output to a file, never through `tee`. ~5 min a sweep once leased; the queue is the real wait. LTX ref tiers
(`scripts/recipe-test.mjs` `refInputs`): bare = cat + Picture 1; medium = the man/rocking chair/Picture 2;
directed = cowboy + Picture 1; overlong = samurai + Picture 1, 2 + Audio 1. Shared with Wan/Seedance: a tier
change there moves their baselines too.

**STATE (2026-10-12 evening, session 5cb627a7) - read this first:**
- Fabio ran eye test 3 WITHOUT clearing his sidecars, beach picture in place of the forest, text "The woman is
  facing the camera and having a picnic at the beach. The hamster shows up and steals one of her oranges." (DeepInfra
  Gemma 4 26B). Lines right (beach got a fresh name + `setting:`); "rat" = the stale kept name, as predicted. SCENE
  bugs: "from the side" for a woman facing the camera; "Low sun through pines" + "worn wool" copied verbatim from
  the r2v SCENE RULES examples (the beach look has a high midday sun, no pines); an invented "slow zoom".
- FIXED in the r2v prompt: light/texture examples removed ("only light that belongs in this scene's place");
  sentence 1 keeps a stated facing ("facing the camera" = from the front); sentence 5 bans an undescribed move;
  sentences 6 and 7 were fused on one line ("delivery.7.") - split. Harness: tier `seen-beach` (his exact text +
  real beach look) with `scene` checks (no side/behind/profile, "remains static", no pines/wool); `runChecks` takes
  `scene`. Tests + eslint green. Sweep T4 ALL PASS 24/24 (validation.md); left: "grass"/"dirt" invented on the
  beach 3 of 6 lines. T4 is the first full green on the CURRENT prompt (T3 ran the old one): Step 3
  wants one more after Fabio's eye test 3.
- DECIDED (Fabio 2026-10-12, eye test 3b/3c "no fail"): (1) his sidecars are NOT cleared - "it doesn't matter if
  the hamster keeps being called a rat"; (2) with no camera behaviour described, the ENHANCER PICKS the move or
  stillness (r2v sentence 5, dos, donts); only a contradiction of the user's shot words is wrong. The `seen-beach`
  static check is gone; the DeepInfra 26B sweep is moot. Sweep T5 ALL PASS 24/24, but read by eye beach run 2
  dropped the theft ("scurries close to her", judge 2/2/2). Added `seen-beach` check "the theft happens" (T4 3/3,
  T5 2/3 regraded) and r2v sentence 3 "every event the user's text names happens on screen, completed". Sweep T6
  T6 21/24 (known flakes: uncaptioned medium, overlong `<Audio 1>` drop; T7 overlong 3/3), **T8 ALL PASS 24/24 =
  STEP 3 DONE** (T4 + T8). Agent guide `docs/agent/models/ltx-2.3.md` r2v Rules synced (camera pick, facing, events).
- Fabio's render ref2v_007 (T8's 12B beach prompt, 3 s) FAILED: ~0.75 s garbled web-page collage, then she hands
  the orange over. Collage suspect = 3 s (ref2v_001-006 all 5 s, clean); asked Fabio for a 5 s re-render, same seed.
  Action fixed: r2v sentence 3 beats, sentence 4 no calm smile; checks recalibrated. Fabio OK'd DeepInfra Gemma 26B
  sweeps (up to 5, ~8 cents): D2 ALL PASS 24/24 (~3 cents spent). Local 12B still loses the theft (T9/T10): a
  12B limit, not the recipe; users run 26B (cloud) or E4B (local default, untested on this).
- Fabio rendered ref2v_008 (5 s) + 009 (3 s) from his 26B Enhance: "it worked", both clean openings. Collage =
  seed-bound 1 of 9, not length (doc noted). NEXT: commit; Fabio's `draft -> validated` flip; close-out.

**STATE (2026-10-12, session 2b4da86d):**
- FIXED ROLES BUILT. `pictureCaptions` asks the describer once per picture `KIND_QUESTION` (person/animal/place/
  object), kept as the sidecar's TOP-LEVEL `lookKind` (not `look.kind`: update-meta merges shallowly and Cosmo's
  `storeLook` replaces the whole `look`, so it would wipe it). `registry.withRoles(text, captions)` rewrites each
  `<Picture n>` line's role word after the enhancer replies (place -> `setting:`, object -> `prop:`, person/animal
  bare); a picture with no kind keeps the enhancer's word. Harness seen tiers carry `kind` and run the same
  `withRoles`. llm-service 32/32 (test asserts the rewrite + lookKind kept + reuse), recipe-registry, agent-corpus,
  ingredients-sheet green, eslint clean.
- In-app rig is now in this session's scratchpad (`drive.sh <port> <out> [order]`, `enhance.js` points describes at
  the keyless `ollama` profile with `huihui_ai/qwen3-vl-abliterated:4b` = free; docs/profile still in d6d1c356's
  scratchpad; `kindprobe.mjs <port>` tests kind questions). Instance STOPPED.
- Results (validation.md § Step 2c): sweep T roles 0/21 wrong. In-app, the first kind question called the valley
  (small hiker in it) `person` and the app stripped the right `setting:`; question reworded (probe: 14/14 on 7
  stills), re-run in-app roles 0/18 wrong. LEFT: the enhancer's DESCRIPTIONS still slip (hamster-first order wrote
  "setting: the forest where the picnic takes place" for the valley 3/3; "a miniature yellow firefighter's helmet"
  for the hamster 1/9). Fabio's eye test 1: roles right, but the recipe heading "PART 1 -- PICTURE LINES" leaked
  and the woman's line carried her photo's pool/pose.
- DECIDED (Fabio 2026-10-12): THE APP WRITES THE WHOLE PICTURE LINE. Built: `registry.withPictureLines` (replaces
  `withRoles`; drops `PART n` headings; unnamed/undescribed pictures keep the enhancer's line), `pictureCaptions`
  asks `KIND_QUESTION` (one word) then `NAME_QUESTION(kind)` (<=15 words, looks only), kept as sidecar
  `lookKind` + `lookName`. One combined "kind: phrase" question broke format on the 4B (probe kind2/kind3); two-step
  probe kind4: 4B 14/14, gemma4:12b horse sheet = animal -> "riding or holding an animal" tweak, probe kind5.
  Tests: recipe-registry 11/11 (`testAppWritesThePictureLines`), llm-service 32/32.
- VERIFIED (agent): probe kind5 4B 14/14; sweep T2 seen tiers 9/9 (medium 2/3 = enhancer's own line on the uncaptioned
  tier, pre-existing); in-app eye5/eye6 18/18 lines right in both orders incl. Fabio's woman/hamster/forest. Instance
  STOPPED.
- Fabio eye test 2 (his app, DeepInfra Gemma 4 26B): lines right but "a light brown RAT" (look says hamster) and the
  SCENE copied the woman's photo ("sits on the edge of the pool") from the look gist sent as caption. FIXED:
  `withReferences` captions a named picture by its looks-only `name`, not the look gist; `NAME_QUESTION(kind, look)`
  quotes the kept look's first sentence ("call the subject what that description calls it"); `tidyName` lower-cases
  a leading capital. Probe kind6: hamster 4/4 on both local describers, no pose/pool. Sweep T3 ALL PASS 21/21, no
  "pool". In-app eye7/eye8 18/18, Fabio's squirting-hose text reads "from the front ... faces the camera".
  Tests: llm-service 32/32, recipe-registry 11/11, eslint clean. Instance STOPPED.
- GOTCHA for eye test 3: a kept `lookName` is reused, so Fabio's three sidecars in "X2.3 references" still hold the
  pre-anchor names ("a light brown rat ..."). Asked Fabio to OK clearing `lookKind`/`lookName` from those three
  sidecars (his project: never without his yes). Then eye test 3 (reload Ctrl+R), then Step 3/4.
  Known edge: a larger describer names a man-on-horse sheet by the horse.

**STATE (2026-10-11 ~20:30, session d6d1c356):**
- Sweep I on the tagged tiers: ALL PASS 12/12, every picture line right (validation.md).
- DESCRIBE STEP BUILT (Step 2b): `llmService.pictureCaptions` + `enhance({pictures})`, opt-in per recipe mode with
  `seesPictures: true` (only LTX r2v; Seedance/Wan r2v unchanged, test asserts it). Card found by matching the staged
  url to `state.currentProject` history; `look` read fresh via `/load-meta-batch`, else `describeImage` + stored via
  update-meta (only when the sidecar exists). Captions go between the idea and the Attached line (still last). Failed
  describe = that caption dropped + named in the dialog's note. Recipe: SEEN PICTURES block. Harness: `seen-picnic`
  (Fabio's live ref2v_004 text + real looks) and `seen-swapped` tiers with a per-tier `roles` check.
  Tests: llm-service 32/32 (new `testEnhanceSeesThePictures`), recipe-registry, enhance-control/overlay, agent-corpus,
  ingredients-sheet green; eslint clean.
- Wording for captions iterated (validation.md table J..Q): the SEEN bullet must sit LAST in PART 1 with the
  "dog dressed as a pirate" example, or "Dressed as a fireman" trips the old "wearing <Picture n> = prop" cue. Captions
  are cut to two sentences in `withReferences`. Sweep Q 17/18 (all roles right; one line used the user's words).
- Fabio (dinner, no GPU) asked me to run the eye test myself: done in MY app:isolated (:63658, own profile + docs =
  scratchpad, copy of "X2.3 references"), real `enhance()` via playwright-cli `drive.sh` + `enhance.js`, under
  gpu_lease. Standard order 3/3 right; shuffled order exposed "guinea pig" vs "hamster" -> helmet-as-prop; near-name
  sentence added. Sweep S 18/21, roles wrong 1/21. Table: validation.md.
- DECIDED (Fabio, 2026-10-12): FIXED ROLES. The 12B slips ~1 in 20 on roles. Build: ask the describer ONE extra
  question per picture (person / animal / place / object), keep the answer beside `look` in the sidecar (e.g.
  `look.kind`; Cosmo's `storeLook` ignores it, never strips it - check), and the APP writes the role word
  (place -> `setting:`, object -> `prop:`, person/animal -> none) instead of the enhancer guessing it. Enhancer
  only describes. Enhance-button path only: Cosmo and MCP never call `enhance()` (checked: no llmService use in
  services/ or routes/connector.js). Cost: one small describe per NEW picture (paid on DeepInfra describe).
  Where the role lands is open: tell the enhancer the role in the caption block, or rewrite the role word on its
  output lines (deterministic - preferred). Then sweep (seen-picnic/shuffled/swapped) + in-app drive (below).
- In-app eye test rig (MY instance, never :3000): scratchpad `boot.sh` (own profile + APP_DOCUMENTS copy of
  "X2.3 references"), `drive.sh <port> <out>` + `enhance.js` (order in its default `'imported_...'` list), run
  `drive.sh` under gpu_lease with the full Git bash.exe path. Instance is STOPPED; reboot with boot.sh.

**STATE AT HANDOFF (2026-10-11 ~20:30, session 5cddf24b):**
- Done and verified: harness `picture role` + `<Audio n> in the scene` checks (`scripts/recipe-test.mjs`); recipe
  thin-line floor; `routes/ingredientsSheet.js` drops `<Audio n>` lines (Fabio's yes, test in
  `tests/ingredients-sheet.test.cjs`, 13/13 with recipe-registry + agent-corpus). Ref2v runs on a RunPod Pod (dev).
- Wording: sweep G 10/12 (all picture lines right; directed invented `<Audio 1>` 2/3 because of a sentence-6 audio
  clause, now REMOVED; "write none" reworded). Sweeps I and J on that text were running at handoff, output in
  `C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5cddf24b-0b82-4a49-bb98-94d71375f00a/scratchpad/step3-full-{i,j}.txt`
  (read with `grep -n -E "^--- |^<(Picture|Audio) [0-9]>|\[XX\]|ALL PASS|FAILURES"`). Both ALL PASS = Step 3 green.
  The sweep script is `sweep.sh` in that same folder (gpu_lease --poll 2, node direct); copy it to the new scratchpad.
- **NEXT (Fabio approved 2026-10-11): the DESCRIBE STEP.** Root cause of "Enhance fails 90%, the sheet shows in the
  clip": the enhancer is text-only, the user does not tag pictures, so it guesses by order (live `ref2v_004` in project
  "X2.3 references": guinea pig labelled "setting: forest clearing", valley labelled "prop: the orange"); the sheet's
  descriptions then mismatch the cells and LTX pastes the sheet. Cosmo, who looks at the pictures, "nailed it".
  Design: in `js/services/llmService.js` `enhance()`, r2v mode only, before the LLM call, describe each staged picture
  and append "what each picture shows" to the user text after the Attached line; recipe r2v tells the model to take
  roles and descriptions from those captions (place = setting:, object = prop:, person/creature = character).
  Reuse, never re-describe: the description lives in the card sidecar `Media/.meta/<itemId>.json` field `look`
  `{ text, describer, at }`, the same field Cosmo's `look` reads/writes (`services/agentTools.mjs` `storedLook`/
  `storeLook`, MPI-870). Verified: imported cards HAVE sidecars and Cosmo's looks are saved there. Read via
  `POST /load-meta-batch {folderPath, ids}` (routes/projects.js:3650), describe via `describeImage({imagePath})`
  (llmService.js:1069), write via `POST /project-media/:id/update-meta?folderPath=` `{itemId, updates:{look}}` (never
  create a sidecar). The prompt box passes `references` as tag strings only (`MpiPromptBox.js:2464`
  `_stagedRefTags()` -> `{tag, item}`); also pass each picture's path + itemId. Fabio: Enhance cost = one describe per
  NEW picture; DeepInfra describes are paid. Then a harness tier with captions, sweep, Fabio's eye test.
- Identity (separate card MPI-1096, in todo): a character sheet ALONE keeps the face; sheet + forest loses it (A/B
  `ref2v_005` vs `ref2v_002`, same seed, Fabio: "that looks more like the same guy"). Face-size rule DROPPED (face only
  -15% on the sheet). Fabio OK'd testing Best-Face-ID on `G:\ComfyUi` (BFS Nodes from GitHub + CharacterSheet LoRA
  ~1 GB from HF; back up the bench's pip list first, insightface install). Licence: none stated = cannot ship;
  emailing the author is Fabio's. Notes: `.agents/mpi-kanban/tasks/MPI-1096/research/shortlist.md`.
- Your call still open for Fabio: keep a setting picture OFF the sheet when a character is on it (text only), or as a
  small cell? Needs a Pod A/B first.

**Progress (2026-10-11, session 5cddf24b):** Step 1 DONE (harness `picture role` check + recipe thin-line floor,
0/3 on the old text). Step 2: roles and descriptions fixed (bare/medium/directed 9/9 in full sweep B). Only failure
left: overlong writes an `<Audio 1>` line in the picture block, 9/9 across three wordings, 1/3 on the fourth (literal
Attached-line example). Waiting on Fabio: make `routes/ingredientsSheet.js` `parseSheetPrompt` skip an `<Audio n>`
line (shipped MPI-1060 file, outside this card's files) vs keep pushing wording. Evidence table: validation.md.
Sweep script: scratchpad `sweep.sh <out> [--tier T]` (gpu_lease, --poll 2, node direct).

## Plan

### Step 1: Make the failures visible to the sweep
- [ ] Add a deterministic check (or a recipe `forbiddenPatterns` entry) for the role case: on the `medium` ref
  tier the `<Picture 2>` line must be a setting. Prefer a recipe-level pattern; a harness check must stay
  model-agnostic (Wan/Seedance have no picture lines). Add a description-length floor per picture line if the
  recipe can express it (e.g. a forbiddenPattern for a `<Picture n>` line under ~5 words).
  **Verify:** re-run the medium tier on the CURRENT text: the new check FAILS where the old sweep passed.

### Step 2: Fix the wording
- [ ] Role rule: "in / at / inside `<Picture n>`" = a place -> `setting:`; "wearing / holding / carrying"
  `<Picture n>` = `prop:`; "the man from `<Picture n>`" = the character. Description rule per failure 2.
  Audio rule once more if failure 3 persists (consider an example output in the systemPrompt).
  Word floor: lower `wordBudget.min` only if the outputs are right and just short (the t2v mode's floor is the
  reference), never to pass a bad output.
  **Verify:** `node --test tests/recipe-registry.test.cjs tests/agent-corpus.test.cjs`; one tier at a time
  (`--tier medium`), then the full `--ref-tiers` sweep.

### Step 2b: Describe step (Fabio approved 2026-10-11)
- [x] r2v enhance is told what each staged picture shows, from the card sidecar `look` (shared with Cosmo) or a
  describe that is then kept. Recipe takes roles/descriptions from it. Harness seen tiers.
  **Verify:** `node tests/llm-service.test.cjs`; sweep with the seen tiers green.

### Step 3: Green twice, then read the outputs
- [ ] Full `--ref-tiers` sweep green TWICE on the final text (3 runs each). Then READ every picture line: a green
  count with a wrong role is still a fail (this card exists because of exactly that).
  **Verify:** both summaries "ALL PASS"; outputs pasted into `docs/recipes/research/ltx-2.3/validation.md` (new,
  template `.claude/skills/create-enhancer-recipe/references/validation-record.md`).

### Step 4: Stage 2 hand-off to Fabio
- [ ] Give Fabio the four final prompts to render on LTX Balanced -> Reference to Video with real pictures (his GPU).
  The `draft -> validated` flip is his. Sync `docs/agent/models/ltx-2.3.md` if the prompt rules changed.

## Verification

**Verify mode:** user-ux (Step 4 is Fabio's render; Steps 1-3 are agent-verified).

## Files

`js/data/recipes/ltx-2.3.recipe.js`, `docs/recipes/research/ltx-2.3/`, `docs/agent/models/ltx-2.3.md`,
`scripts/recipe-test.mjs` (only if a check must live there), card folder. Procedure: `/create-enhancer-recipe`.
Step 2b: `js/services/llmService.js`, `js/data/recipes/registry.js` (`withReferences` captions),
`js/components/Organisms/MpiPromptBox/MpiPromptBox.js`, `js/components/Compounds/MpiEnhanceDialog/MpiEnhanceDialog.js`,
`tests/llm-service.test.cjs`.
