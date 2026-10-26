# MPI-1231 Storyboard Flow (LTX 2.5 release, dev-gated)

## Current State

- 2026-10-24 ("LTX 2.5 model 10"): design DECIDED (brief.md top section). Ships ALONE in the LTX 2.5
  release (umbrella MPI-1267); Keyframes (MPI-1191) left it. Research:
  `research/codebase-2026-10-24.md`. Nothing built. Depends on MPI-1268 (reorder + Create Sheet) for the
  final ordering and the overview; panel generation can start before.
- Shape: idea in words + OPTIONAL pictures of characters/places (zero or many) -> a planner writes N panels (a picture
  prompt + an intent line each) -> FLUX.3 Klein edit draws each panel from the references -> one STACK
  of panel cards in story order, each with its intent line as the card NOTE -> the numbered overview.
- 2026-10-24 ("LTX 2.5 model 12", no GPU): Phase 1 plumbing BUILT. Flow dev gate = `devOnly` on a
  FlowDef, filtered at the `FLOWS` export (`ALL_FLOWS`), `tests/flow-dev-gate.test.cjs` (both configs in
  child processes, mutation-checked). Driver = `js/services/storyboardRunner.js` `runStoryboard(panels,
  {name}, deps)`, pure like routineRunner; 7 tests. Deps NOT wired yet: the renderer side (submit via
  `submitFlowGeneration` + `runLanding`, addStack, update-meta note, `reorderStack`, `/combine-images`
  numbered+whole) lands with the FlowDef. A stopped run gets its order but no overview. NEXT: Phase 0
  (GPU) or the FlowDef via /mpi-add-flow. Planner `[PANEL n]` parser not written (Phase 0).
- 2026-10-24 ("LTX 2.5 model 12", no GPU): FLOW WIRED, devOnly. `driver: 'storyboard'` on the FlowDef ->
  MpiBaseFlow `_run` calls `FLOW_DRIVERS` (`js/shell/storyboardDispatch.js`); panels are plain FLUX.3
  Klein gens via agent `buildGeneration` (edit w/ refs, t2i without). `flowStoryboard` op = slots only.
  `parseStoryboardPlan` + DRAFT planner `STORYBOARD_PLAN_ENHANCE_PARAMS`. buildFlow refuses
  (`OPENS_FOR_USER`), routines refuse. Full suite green; modules load in an isolated page (age gate
  not clicked: Fabio's consent). NOT run live (GPU). Doc: existing-flows/storyboard.md. NEXT: Fabio
  looks at the Flow in his app (dev), then Phase 0 on the GPU (planner + panels).
- 2026-10-25 ("LTX 2.5 model 12", Fabio's first look): shapes = LTX's 16:9 / 9:16 / 21:9 / 1:1 (21:9 as
  exact pixels `WIDE_21_9`, built + checked in an isolated page); ten slots -> `grid: true` numbered tile
  grid (MpiBaseFlow `_buildSlotGrid`), which should also stop the info column being pushed down. 208f9ccd0.
  NOT SEEN on screen (isolated copy stops at the 18+ gate; never click it). NEXT: Fabio's look, then Phase 0.
- 2026-10-25 ("LTX 2.5 model 13"): Fabio approved the layout ("Looks right"). Phase 0 benched on :8188
  (`research/phase0/`, results in validation.md): the shipped DRAFT planner (v1) drops the cast after
  panel 1 and invents pictured looks; v2 = `[CAST]` block written once + code appends each named cast
  line, picture lines from the user's "Picture N is NAME, a WHAT." -> consistent cast on 18 panels.
  Fabio's eye PASSED ("so freaking cool ... port V2"). v2 PORTED (uncommitted): planner prompt in
  flowsRegistry.js (+ "name every time", "speech in the Intent"), `parseStoryboardPlan(plan, idea)`
  cast-aware (2 new tests), dispatch passes the idea, hint/placeholder name "Picture 1 is Lena, a
  waitress.", storyboard.md. Reparse of the bench plans = the 18 drawn prompts; lint clean; npm test
  3624 pass / 0 fail. Shipped prompt then run once on the 4B (`out_final/`): it found the glued-cast
  parser bug, fixed + tested (12 runner tests; npm test 3625 pass / 0 fail). NEXT: commit
  (mpi-handoff), then the Phase 1 live run in Fabio's app (Enhance + Generate, a 6-panel board lands as
  one stack with notes + overview), then Phase 2.
- 2026-10-25 ("LTX 2.5 model 14", Fabio's asks while his live run waits): (1) plan hint now three
  lines, incl. "a calm moment reads well in 4 to 6; a fast action scene with many cuts wants 10 to
  12, one panel per cut" (hint only, planner prompt untouched). (2) NEW field type `pictureNotes`:
  the plan step's LEFT column = the first step's pictures as cards (scrolling 2-col grid) with a
  note box each; other fields `col: 'right'`. Notes -> "Picture N is ..." via `mapDeclaredValue`
  (Enhance source + appended to the idea in storyboardDispatch); persisted as sentences, read back
  by `readPictureSentences` in `_seedField`; a cleared slot drops its note (`_prunePictureNotes`).
  Eye-checked in my isolated instance (cards, restore, typing -> enhance source, clear -> prune);
  tests + lint green. NOT yet seen by Fabio. OPEN: a cleared MIDDLE tile leaves a gap, but
  `_references` compacts the refs, so tile/note "3" becomes FLUX's second image (pre-existing).
- 2026-10-25 ("LTX 2.5 model 14") LIVE BLOCKER: Fabio pressed Enhance in his app (after the 03:09
  reload, idea filled): button pressed a while, released, plan box EMPTY, no toast, no queue row,
  NOTHING in app.log. His LLM backend = `endpoint` (DeepInfra; leveldb `cubric.llm.backend`), so no
  queue row by design (server-side `/llm/enhance`, routes/llm.js:405). `runEnhanceDecl`
  (flowEnhance.js) logs only on `ok && text` or `!ok && !cancelled`, and `_runEnhance` writes only
  on `ok && text`: so the result was `ok:true` with EMPTY text (routes/llm.js returns
  `String(result.text||'').trim()`), or `cancelled`. Most likely: the endpoint model spent its turn
  on reasoning / returned empty content for the 12-panel planner prompt (max_tokens 3200), or
  `postProcessLikeGraph` emptied it. NEXT: (a) find WHY empty: one endpoint call with the real
  planner system prompt (costs a DeepInfra call: ask Fabio first) or read the engine
  (services/llmEngines.mjs `complete`, reasoningEffort, recommendedModel 'enhance'); (b) an
  `ok` with empty text must be a VISIBLE failure (every end visible): fix in `runEnhanceDecl`/
  `enhanceFlow` for every caller, not in the frame. Also: an endpoint enhance shows no progress
  anywhere while it runs (the "every action shows itself" rule).
- 2026-10-25 ("LTX 2.5 model 15"): DIAGNOSIS CORRECTED. Fabio's backend is `comfy`, not endpoint
  (his leveldb decoded properly: 000030.ldb `cubric.llm.backend` = comfy; the "endpoint" string was
  an older table). His words: "nothing at all - no warning, the button looked normal", no queue row,
  and no ComfyUI "got prompt" 03:09-03:16: the press never reached a dispatch. NOT reproduced: in an
  isolated copy (backend comfy, typed idea / empty idea / after a reload) the button goes
  "Enhancing..." and dispatches every time; a throw would be logged (window error hook, factory emit
  does not swallow), and the queue has no silent self-cancel. Shipped anyway (handoff mandate,
  every end visible): an EMPTY enhancer answer is now a named failure for every caller -
  `/llm/enhance` `_enhanceAnswer` (endpoint + ollama, names the model and the token cap from the
  engines' new `finishReason`), `runComfyEnhance` onText, and `_enhanceFlowOn` when the scrub
  patterns empty a reply. 2 tests. NEXT: Fabio reloads and retries Enhance, saying whether the
  button turns to "Enhancing..."; if it still does nothing, it is a click that never reaches
  `_runEnhance` in HIS frame state (pictures on step 1? a reused frame?) - get his exact steps.
  Also noticed: Enhance runs with an EMPTY idea (panel count + ratio lines alone make a source).
- 2026-10-25 ("LTX 2.5 model 15", Fabio's retry 03:49): the fix SHOWED it - toast "google/gemma-3-12b-it
  answered with nothing", app.log `answered nothing (finish: stop)`. So the backend IS endpoint after
  all (my leveldb read missed the newest WAL value; the handoff before was right), model = his pick
  gemma-3-12b-it, and it ends its turn with zero words, no cap hit. His run: 3 pictures with notes
  (Jasper the Protector / Tiki the villain / Tikori and Mr. Tiger), idea about a villain demanding a fee,
  6 panels. The planner prompt was only ever benched on the ComfyUI 4B. NEXT: Fabio approved up to 3
  DeepInfra calls (< $0.01 total) on gemma-3-12b-it with the exact system + user text his press sent
  (rebuild via enhanceSourceText + unwrapChatMl of STORYBOARD_PLAN_ENHANCE_PARAMS, send with
  DeepInfraEngine.complete from node); vary one thing per call (input, then system prompt) to find the
  cause, fix at the root. Suggested workaround meanwhile: enhance model -> gemma-4-26B-A4B-it.
- 2026-10-25 ("LTX 2.5 model 16", 6 DeepInfra calls, $0.0007): ROOT CAUSE - DeepInfra reads a
  gemma-3-12b reply that STARTS with `[` as a tool call and returns empty content, tokens billed
  (~1000; logprobs showed only the tail after the last `[`; `tool_choice: "none"` does not help).
  "[HELLO] world" -> "", "HELLO world" -> itself, planner told to open on "Storyboard plan:" -> the
  full plan. FIX (uncommitted): both marker recipes open on words - Storyboard
  `Start with the words "Storyboard plan:", then [CAST]`, Music Maker (released, same trap)
  `Start with the words "Music plan:", then ... three blocks`; parser/splitEnhanced already skip
  text before the marker. Guard: tests/enhance-opener.test.cjs (fails on HEAD's prompts). Lint
  clean, npm test 3630 pass / 0 fail. Music Maker's new opener NOT run live on any model.
  ALSO SEEN: gemma-3-12b breaks the planner format - "Picture: Picture 1 is Jasper the Protector.
  Intent: ..." with the prose AFTER the Intent, and full looks for pictured characters - so its
  panels would draw from the one-liner. The 12B is a weak planner; gemma-4-26B is the pick.
  NEXT: Fabio retries Enhance (plan box fills, opens "Storyboard plan:") + Generate a 6-panel board.
- 2026-10-25 ("LTX 2.5 model 16", Fabio's call): PLANNING IS COSMO'S JOB. The button is "Plan with
  Cosmo" (busy "Cosmo is planning…", icon sparkle) and runs on the AGENT's connection + model
  (`runsOn: 'agent'` on the decl -> `enhanceFlow({onAgent})` -> `/llm/enhance` `job: 'agent'`; an
  empty pick -> recommendedModel(...,'agent'); a table row's `reasoningEffort` now rides on every
  `/llm/enhance` endpoint call, which also fixes enhance on DeepSeek 0731). No connection/key/model
  -> `NO_AGENT` -> warning toast "This Flow needs an agent..." with an "Open Remote" button
  (MpiBaseFlow `_openRemote`). `busyLabel` is a new optional decl key. Cap 3200 -> 8000: DeepSeek V4
  Flash (effort low) spent 1,923 reasoning + 776 answer tokens on the 6-panel plan, clean format,
  $0.0005. Tests: llm-describe (+2 route), flow-enhance (+1 client); lint clean, npm test 3633/0.
  NOT SEEN on screen (the isolated copy stops at the 18+ gate). Total DeepInfra spend this session
  $0.0012 (7 calls). NEXT: Fabio reloads, presses Plan with Cosmo, Generates the 6-panel board.

- 2026-10-25 ("LTX 2.5 model 17", Fabio's first Plan with Cosmo result): the plan FILLED (one line, as
  designed). FOUND: the panel prose re-describes pictured cast ("Fox (a small, bright-orange fox ...)"
  when picture 3's fox is purple; "the Sphinx, a massive mythological beast ... eagle wings" when picture
  1 is a hairless cat noted only "the bad guy"): the pictured-cast rule covered the [CAST] line only.
  FIX (uncommitted): a planner bullet "Never describe a cast member's looks in a Picture". Lint + prompt
  tests green; NOT run live (a DeepSeek call, ~$0.0005, needs Fabio's yes). Fabio told to delete the two
  descriptions in his plan box by hand before Generate. Noticed: the one-line plan is a wall to edit.
- 2026-10-25 ("LTX 2.5 model 17"): the fixed planner run ONCE on DeepSeek V4 Flash 0731 (effort low) with
  Fabio's board (notes reconstructed from his cast lines), $0.0004: no looks in any Picture, 6 panels,
  script `scratchpad/plancall.mjs` pattern. Left: Jubie (a white tiger) got "arms"/"hand" because the
  note said only "the protector warrior" (the planner cannot see). PARSER FIX: "Picture 1 is The
  Sphinx" now drops its article, so it replaces the planner's "Sphinx" line instead of a second one
  (test added; 14/14 storyboard + opener tests, lint clean).
- 2026-10-25 PANEL MODELS DECIDED (Fabio): edit models only, so Chroma/MOSS are out. Two routes:
  FLUX.3 Klein (default) and Qwen-Image 2.1 (non-commercial, gated by its own licence). Shape: a
  choosable slot `requiredModels: [{ label: 'Panel model', models: ['flux3-klein', 'qwen-image-2-1'] }]`
  (any-of-models.md; no graph, so no modelParams: the driver reads `flowModelIds(flow)` instead of
  MODEL_ID). Qwen 2.1 takes 8 references (FLUX.3 10), has no turbo toggle; check 21:9 pixels on it.
  Bench Qwen 2.1 on the same plan BEFORE wiring (local GPU, Fabio's go). Licence copy: the model's
  existing gate, never "personal use" (the Qwen research licence grants research/evaluation only).
- 2026-10-25 PICKER WIRED (uncommitted, Fabio "give the option"): slot `Panel model`
  [flux3-klein, qwen-image-2-1]; storyboardDispatch reads `flowModelIds(flow)`, refuses more pictures
  than the model's edit takes (`_maxReferences` from COMMANDS.edit + capabilities: 10 / 8) with a
  toast, sends turbo only when `resolveTurboControlId(model)`; Turbo field `hiddenWhen modelNot
  flux3-klein`; storyboard.md updated. Lint clean, 40 Flow tests green. Bench
  `research/models/bench.mjs` (Fabio's 3 Tikori pictures, the DeepSeek plan, 6 panels x 2 models,
  same seeds, 1344x768 edit) queued under the GPU lease behind MPI-1039's Blender job.

- 2026-10-25 BENCH (research/models/, validation.md): FLUX.3 ~49 s vs Qwen ~78 s/panel, no clear
  winner; both keep the picker. Misses trace to the planner being BLIND: both drew the Egyptian
  Sphinx monument, a humanoid tiger, an extra orange fox.
- 2026-10-25 DECIDED (Fabio): EVERY picture is ALWAYS described before planning, note or no note.
  The note is the user's reference/purpose ("the bad guy"), never a description. Plan with Cosmo =
  describe each picture (vision, `/llm/describe`) -> Cosmo gets per picture: the description + the
  user's note, plus the idea -> plans the story. The cast line drawn into each panel carries the
  description ("Sphinx is the hairless grey cat from the first image") so the word "Sphinx" cannot
  beat the picture. NEXT SESSION builds it: every end visible (describe progress inside the
  "Cosmo is planning..." press), cost per picture stated, a failed describe = a named failure.
- 2026-10-25 ("LTX 2.5 model 18"): DESCRIBE-FIRST BUILT (uncommitted). Button decl
  `describePictures: { field: 'pictureNotes', ask: STORYBOARD_PICTURE_ASK }` (one phrase, <= 20
  words, starts "a/an"); frame `_sourceWithPictures` -> `flowEnhance.describePictures` (one QUEUED
  `describeImage` per picture on the Remote describe pick, cached per picture+ask, button "Looking at
  picture N of M…", fail = warning naming the picture, Cosmo not called) -> planner source "Picture 1
  is NOTE. It shows LOOK." (`pictureSentences(notes, looks)`, planner input only) -> planner prompt
  copies LOOK into the cast line "Name: LOOK from image N", "an animal stays an animal". Parser
  precedence FLIPPED: the plan's cast line wins over the note's line (fills only missing names).
  Info toast after the plan lands: `picturesCostLine` (DeepInfra price per picture / free on
  ComfyUI / described before). Tests: 3 new in flow-describe, runner precedence test rewritten;
  lint clean, npm test 3652 pass / 0 fail. NOT RUN LIVE: the describer's phrase and whether
  DeepSeek copies it verbatim are unverified (needs Fabio's yes: ~3 describes + 1 plan, < $0.002),
  and the frame path is not seen on screen (isolated copy stops at the 18+ gate).
  NEXT: the live check, then Fabio's 6-panel Generate.
- 2026-10-25 LIVE CHECK PASSED ($0.0006, validation.md "Describe-first planning"): describer phrases right,
  DeepSeek copies them verbatim into [CAST], no monument, tiger stays a tiger. NEXT: Fabio reloads and
  presses Plan with Cosmo in his app (button text, queue rows, cost toast), then Generates the 6 panels.
- 2026-10-25 FOLDED IN (peer "Flux 3 on flows 27" found it, card MPI-1287): the frame's media restore put
  a picture with another group's role into an empty single slot BY POSITION (Character Sheet Editor sent
  the face as the full-body ref). Restore loop now `restoreSlotItems` (declaredFields.js), skips a
  foreign role; test in flow-describe (fails without the fix). npm test 3661/0. Uncommitted: when it
  lands, give the peer the hash so it closes MPI-1287.
- 2026-10-25 ("LTX 2.5 model 19", Fabio's ask, no GPU): RECURRING ACTORS GET A PICTURE FIRST. An
  unpictured `[CAST]` member named in 2+ panels (dragon, red truck) is drawn first (t2i 1:1, grey
  background) into its own "<name> · Cast" stack (Fabio's pick), then the panels run as edit with it
  as a reference ("Dragon is ... from image N"). Places excluded (Fabio's pick): planner prompt now
  writes a `[PLACES]` block after `[CAST]`. `recurringActors` + `actorImages` in storyboardRunner.js,
  `sheet: false` + `item` on rows, cast stage in storyboardDispatch.js. 2 new tests, npm test
  3669/0, lint clean. UNCOMMITTED. NOT RUN LIVE: the planner's `[PLACES]` split (one Cosmo plan) and
  the cast stage (GPU, Fabio is using it). NEXT: Fabio's live look covers both: Plan with Cosmo
  (check [CAST]/[PLACES]), then Generate (Cast stack first, then panels).
- 2026-10-25 ("LTX 2.5 model 19", Fabio's live Plan press): PLAN PASSED - [CAST] White Tiger/Cat/Lion/
  Fox "from image N", Dragon unpictured (-> drawn first on Generate), [PLACES] Forest Entrance/Clearing.
  Describes 3.5 s total (not blocked by the peer's GPU work); Cosmo's plan 71 s on DeepSeek V4 Flash with
  NOTHING on screen. ROOT: every server-backend enhance (`runServerBackend`) was a bare fetch. FIX: a
  user's enhance (enhanceFlow + enhance(), default `queued`) is now a cloud-lane queue job through
  `describeExecutor.js` (`enhanceEndpoint` config -> `/llm/enhance`): row, sweep, status bar, Stop.
  Child-safety judge and `settleInGraphEnhance` stay bare (`queued: false`, guarded by
  in-graph-enhance.test). Toast "$0.0000 a picture" -> `formatPrice` ("about $0.00002"). npm test
  3671/0. NOT SEEN live: the queue row (Fabio's next Plan press). 180 s rule = REMOTE_CHAT_TIMEOUT_MS
  per hosted call (llmEngines.mjs): a 6-panel plan 71 s; a 12-panel one may near it (named TIMEOUT
  toast, not silent). NEXT (Fabio's ask): Cosmo peek animation at the bottom of the Flow UI while the
  plan is written; then Generate with the Dragon cast stage when the GPU is free.
- 2026-10-25 ("LTX 2.5 model 20"): COSMO PEEKS BUILT (uncommitted): any enhance decl with
  `runsOn: 'agent'` plays `assets/mascot/studio/peek.webm` along the frame's bottom edge, peek after
  peek at a random x (0.7-2.2 s gaps), from press to settle; none under reduced motion. MpiBaseFlow.js
  (`_cosmoPeeks`, hooked in `_runEnhance` + its finally, torn down via `_unsubs`) + .css
  (`__peek`, the prompt box's 62/182 window at 220px). Lint + npm test 3671/0. NOT SEEN on screen
  (18+ gate). Fabio was generating the 6 panels when this landed. NEXT: Fabio's eye on the peeks and
  the panel run, then commit.
- 2026-10-25 ("LTX 2.5 model 20", Fabio's live Generate): NO LATENTS in the frame's result pane - the
  driver path skipped the frame's run tokens by design, and the pane paints only its own tempIds.
  FIX (uncommitted): drivers get a 3rd arg `{ onJob(tempId, done) }`; storyboardDispatch `_deps`
  reports each queued cast picture/panel (landingOpts tempId); MpiBaseFlow `_followDriverJob` makes it a
  run (latents, sweep, Stop on the running panel, result on land). multiAngle ignores the arg. Lint +
  npm test 3671/0. NOT SEEN. ALSO: the status bar's "EDITING · 1" is the graph STAGE, not a count, and
  says nothing of the panel number the queue row shows ("5 / 6"): Fabio found it confusing; proposed
  the status bar name the batch position (statusBar.js, all batches) - his call.
- 2026-10-25 ("LTX 2.5 model 20"): Fabio's 6-panel board PASSED his eye ("I think this is a win";
  panel 5 an extra lion, panel 4 no surprise at the tiger: fixable later). FIX (uncommitted): a ONE-
  picture run is a plain card named for the run, no stack of one (`runStoryboard`: stackId null,
  landing `cardName`); a lone cast actor's card is named for the actor ("Dragon"). +1 runner test;
  npm test 3672/0. OPEN (Fabio asked "how do I reuse this flow?"): panels are plain FLUX cards with
  no `flowId`/`flowInputs`, so card Reuse fills the prompt box with that panel's prompt and the
  Storyboard's inputs live only in session `s_flowInputs` (gone on restart). Proposed: stamp
  flowId + the frame snapshot on each panel so Reuse reopens Storyboard (`openFlowFromReuse`) -
  his call.
- 2026-10-25: Fabio's eye PASSED the Cosmo peeks ("Cosmo peek is working"). Still to see: live
  latents in the pane + the lone Dragon card on his next Generate. His screenshot shows the
  "Lena, a waitress" placeholder under a cat and a tiger (the Noticed item: reads like a value).
- 2026-10-25: Fabio: peeks too repetitive. Now a different clip each peek (`_PEEK_CLIPS`: peek, then
  agent-thinking/-listening, idle-1..3, greet-1/2, never the same twice running). Measured: every
  standing studio clip's rest head row is 187/620 (feet 556), so `--standing` hangs it by that row
  (the agent-chat ledge rule) and slides it up (`--t-base`); happy-1/heads-up left out (hands to
  row 80-110 would shear). Shown on `playing`, not on src set. Framing eye-checked in a scratch page
  (all 8 read as a head over the edge). Lint + npm test 3672/0. Fabio's eye next.
- 2026-10-25, Fabio's 2nd board (cat vs white tiger by a volcano, Qwen-Image 2.1 edit, 6 panels):
  LATENTS PASSED ("Latents came out nicely"). Faults, read from the panel sidecars
  (Documents/Cubric Studio/Projects/Tikori Characters/Media/.meta): (1) PARSER: "from image 1The
  Tiger:" (newline stripped next to a digit) cut the name to "Tiger" and glued "The" onto the cat's
  line -> FIXED, a name may follow a digit (+1 test, 16/16). (2) STYLE: his pictures are 3D-cartoon,
  the planner opens every panel on "Full-color cinematic film still" (no style named) and the picture
  ask never names the medium -> photoreal panels. (3) SETTING LEAK: the describe answered "a white
  tiger ... sitting in a green forest", copied into every tiger panel against the volcano. (4) PLACES:
  "Volcano Ridge" is words only; panels 4-5 never name it so get no place line; the volcano differs
  every shot. Fabio: "maybe we need to rethink adding environments as well". (5) No model prompting
  guide reaches the planner: one model-neutral prompt for FLUX.3 and Qwen 2.1. (6) Panels carry NO
  flowId/flowInputs (sidecar flowId null), so Reuse cannot reopen the Flow. NEXT (needs Fabio's yes,
  ~$0.002 of DeepInfra): picture ask names the art style and never the pose/surroundings; planner opens
  on the pictures' style when the user names none; re-plan his volcano board and compare.
- 2026-10-25 STYLE/SETTING FIX (uncommitted, Fabio's yes): `STORYBOARD_PICTURE_ASK` asks art style
  first and never pose/surroundings; planner opens on the pictures' style ("3D-animated cartoon film
  still, ") when the user names none, the same every panel. Re-bench `research/style-fix/rebench.mjs`
  (out.json), his models, $0.0005: looks "a 3D-animated cartoon hairless grey cat ... amber eyes" /
  "... white tiger with brown stripes and a muscular body" (no forest); all 6 panels open on the
  cartoon style; names clean ("Cat", "Tiger"); [PLACES] "Volcano's Edge" named only in panel 6. NOT
  drawn (GPU = Fabio's). Also in flowsRegistry: Multi-Angle 31's label line ("good for consistency
  and zooming out"), at its request - commit it with this. npm test 3674/0.
  OPEN product call: draw a recurring place first (overturns "places never drawn").
- 2026-10-25 PUSHED a9cf62a0a (peeks, latents, lone card, glue fix, style fix, peer label). Drew the
  re-plan via MCP generate (qwen-image-2-1 edit, 16:9 1k, refs t2i_d919b5be.png cat + t2i_8ef43aa4.png
  tiger) into Tikori Characters: "Volcano v2 · 1-3" LANDED, 4-6 CANCELLED (GPU wanted by a peer).
  Prompts: research/style-fix/out.json. NOT LOOKED AT yet. Fabio: agent/MCP access to Storyboard
  (buildFlow refuses OPENS_FOR_USER today) is the LAST step, after 2.1.3, since the Flow is dev-gated
  and ships with LTX 2.5.
- 2026-10-25 ("Storyboard 21", Fabio's GPU yes): "Volcano v2 · 4-6" drawn (edit_016-018). Versus the
  first board (sheet_002): cartoon style HELD on every panel; forest mostly gone (trees still behind
  panel 3). New faults: the PLACE drifts (three different ledges in 1-3; panel 2 has no volcano at
  all) - evidence for drawing a recurring place first; panel 6 BLENDED the two refs (a striped
  sphynx-tiger on the ledge) when Tiger is the lone close subject and Cat a far lump. Panel 1 (no
  characters) reads photo-like. Product calls (place first, Reuse reopens Flow, status bar
  "panel n/N") still waiting on Fabio.
- 2026-10-25 ("Storyboard 21") Fabio TOOK ALL THREE PICKS, BUILT (uncommitted): (a) `recurringActors`
  now returns places too (`place: true`, after the characters); a place is drawn at the video's
  ratio, empty and wide (`_castPrompt`), and its line gets "from image N" like an actor's. The
  planner now names the place by its [PLACES] name in every panel, else nothing recurs (the volcano
  plan named it once). Cast and place pictures open on `panelStyle(panels)`, the panels' shared
  first clause, so a cartoon board gets cartoon references. (b) every Storyboard job carries
  `flowId` + `flowInputs` (the frame's inputs), so Reuse > Apply to App reopens the Flow. (c)
  `flowStep` "panel n/N" ("picture n/N" for the cast run) in the status bar, which also hides the
  graph's bare stage. NOT eye-tested in the app: needs a fresh Plan with Cosmo + Generate (GPU).
- 2026-10-25 Fabio's bat-cave board (no pictures, "anime style"): status bar "picture n/7" WORKS;
  7 references drawn first (Squirrel, Rabbit, Bats, Gold Helmet, Gold Elephant, Bat Cave, River),
  every prompt opened "Anime film still." yet squirrel/helmet/elephant came back 3D renders and the
  River photo-like: "Reference picture ... even studio light" won. Fixed (uncommitted, NOT re-drawn):
  `_castPrompt` opens AND closes on the style, no studio light when a style exists. Idea box rows
  4 -> 8 (Fabio). Open: 7 refs on Qwen (max 8) - does quality fall?; a swarm drawn as a reference.
- 2026-10-25 ("Storyboard 22") FIXES 3+4 COMMITTED 06328dd08 (not pushed; MPI-1293's three driver
  edits ride in it at that session's request - it pushes both together). Planner: [CAST] = characters
  and creatures only, a crowd/swarm/flock "is never a cast line: say it in words", new [OBJECTS] block.
  `recurringActors` returns `kind` (character/place/object), ordered character > place > object;
  `MAX_DRAWN_FIRST` = 4 caps the cast in runStoryboardFlow (min with free slots; toast says which).
  ONE re-plan of his bat-cave idea on DeepSeek V4 Flash ($0.0006, research/crowd-cap/out.json): no
  Bats in [CAST], helmet + elephant in [OBJECTS]. It exposed two PARSER faults, fixed + tested: a
  name may hold "the"/"of" ("Cliff Over the River" read as "River"), and another name is no
  mention ("Bat Cave Interior" counted as "Bat Cave Entrance", "Gold Helmet" as "Gold Elephant").
  Reparse: drawn first Squirrel, Rabbit, Bat Cave Interior, River; Gold Helmet stays words. npm
  test 3681/0, lint clean. Doc line storyboard.md:76 still says "never [PLACES]" - stale, fix when
  MPI-1293 releases docs/playbooks/add-flow/. GPU run: see next entry.
- 2026-10-26 ("Storyboard 22") THE ONE GPU RUN (validation.md "Crowd + 4-picture cap"): passes on cast
  consistency, style, crowd and cap. Fixed from it: result stack settled early when a panel waited for
  the child-safety judge (generationService `_holdUntilQueued`, all callers) and the Cast stack lost
  " · Cast" to truncation. npm test 3682/0. NEXT: Fabio's eye on research/crowd-cap/gpu/sheet.jpg +
  refs.jpg (photo-like river; panel 1 inside not at the entrance - should a place picture ride only
  the panels that name it? today every drawn picture rides every panel), then Phase 2.
- 2026-10-26 Fabio DECIDED: a drawn PLACE picture goes only to the panels that name that place
  (characters/objects still ride every panel). Build it, NO GPU run. Design (not started): a pure
  runner fn (e.g. `panelsWithDrawn(plan, idea, drawn, firstImageNo)`) giving each panel its picks =
  drawn non-places + drawn places it `_mentions` (pass `names`), numbering "from image N" per panel
  from those picks (factor parseStoryboardPlan's per-block body out); the dispatch cast-path passes
  each panel its own `references` and `submit` uses `panel.references ?? references` (t2i when empty).
- 2026-10-26 ("Storyboard 23") PLACES PER PANEL BUILT as designed: `panelsWithDrawn(plan, idea,
  drawn, userPictures)` + `_panel` factored out of parseStoryboardPlan; dispatch sends each panel its
  own list. Also MPI-1293's audit fix: a Stop during the first cast build reads as info. Runner test
  added; reparse (research/crowd-cap/reparse.mjs) on the bat-cave plan: cave only in panels 2-4, river
  only 5-6 (as image 3), panel 1 (Entrance) no place picture. NO GPU run (Fabio). NEXT: Fabio's eye
  on research/crowd-cap/gpu/sheet.jpg + refs.jpg, then Phase 2.
- 2026-10-26 Fabio: the bat-cave run "looks good" (it was FLUX.3 Klein, turbo). He asked for LoRAs:
  Panel model slot now `loras: true` (the existing per-slot cogwheel; the panels are plain model
  generations, so the model's own rack injects as flat Lora_N, no loraPhases). Test in
  flow-lora-rack (mutation-checked). Playbook + /mpi-add-flow: EVERY new Flow declares `loras: true`
  on each model slot. NOT SEEN on screen. Other Flows still without a rack: Multi-angle (peer card
  MPI-1039), Pano 360, Make Seamless (Foley + Outpaint by Fabio's call). NEXT: Phase 2.
- 2026-10-26 Fabio: Make Seamless / Pano 360 need no LoRAs; the playbook + /mpi-add-flow now ASK him
  whether a new Flow takes LoRAs when its workflow is made (5d5467fd0). Master went red on a peer's
  peek (MPI-1295), fixed by that peer in 002aaede4, CI green. HANDOFF: next = Phase 2.
- 2026-10-26 ("Storyboard 24") PHASE 2 BUILT (uncommitted), no GPU/money: tile `flow-storyboard.webp`
  (896x1120 q86, 214 KB) + hero `.mp4` (1280x720, 7.96 s, 469 KB, loop seam 0.008/255) from the
  bat-cave run's real panels under "[Your idea] A squirrel and a rabbit sneak into a bat cave for a
  gold helmet." in the app's type; the hero lands panels 1-6 in order. Sources:
  `research/graphics/` (layout page + ffmpeg script; plates were the run's Media in a dead
  scratchpad, copy them before it is cleared if a rebuild is likely). Wired in flowsRegistry; both
  200 + exact bytes from an isolated instance; playback proven in the Browser pane (playwright
  Chromium has no H.264: new 06 trap row). Agent (07): `does` reads right, handover test already
  pins `agentOpens: 'run'`; flows.md paragraph WAITS for the gate (storyboard.md § Agent; flows.md
  is at its 200-line cap). Release note: UNRELEASED.md § "Held for the LTX 2.5 release" (roster
  line + entry) and /mpi-version-bump now leaves a Held section in place. Lint clean, npm test
  3684/0. Fabio's eye PASSED the tile + slide-over ("They look right"); committed. Hero inside the
  open Flow not yet confirmed by him. NEXT: the LoRA cogwheel on screen, then (after 2.1.3) Cosmo +
  MCP run the Flow, and at the gate-off bump: flows.md paragraph + fold the Held release note.

## Phase 0: Panel recipe - `user-ux` (local GPU, Fabio's yes; no money)

- [x] Planner system prompt on `/llm/enhance` (routes/llm.js:390) returning `[PANEL n]` blocks (picture
  prompt + intent line), parsed in JS; tested through the enhancer harness on the user's default LLM.
  Then 2-3 storyboards drawn by hand-run FLUX.3 Klein `edit` (up to 10 references, `multiReference10`)
  at the video's ratio (send ratio / Custom size: output otherwise follows picture 1). **Verify:**
  cast stays consistent across 6 panels; panels read as one scene in order; Fabio's eye. Record in
  `validation.md`. Fail -> try Qwen-Image 2.1 / Klein 9B before building.

## Phase 1: Flow - `auto`, then `user-ux`

- [x] **Flow dev gate (new, small):** no Flow gate exists today (`FLOWS` returned whole by `listFlows`,
  flowsRegistry.js:539/:2963). Add `devOnly` on a FlowDef, filtered like plugins
  (`pluginsRegistry.js:174`) on `APP_CONFIG.dev_mode`. **Verify:** unit test, a devOnly Flow is absent
  from `listFlows` in a release config. (Source: `tasks/MPI-1191/research/flow-machinery.md`.)
- [ ] FlowDef via `/mpi-add-flow`, `devOnly: true`:
  one step: the idea (text), reference pictures (media group `upto`), video ratio, panel count, an
  editable plan box filled by Enhance (like Character Sheet's enhanced prompt), Generate.
- [ ] Storyboard driver (client, `js/services/`): one stack id, N `submitFlowGeneration` with
  `runLanding {batchId, batchLabel, batchTotal, stackId}`, `addGroup(resultStackFields)` AFTER the first
  job (the settle drops a stack with no live job), loop-armed guard as in `_runStack`, panel index kept
  per card (`flowInputs`). One collapsed queue row with Cancel all; every end visible.
- [ ] On each completion: write the intent line as the item note (`POST /project-media/:id/update-meta`,
  only for a real item id). On settle: `reorderStack` to panel order (MPI-1268), then Create Sheet's
  numbered overview (MPI-1268) as its own card. A failed panel leaves its gap visible, not hidden.
  **Verify:** `npm run lint` + `npm test` (driver unit tests: order after interleaved arrival, a failed
  panel, cancel); `npm run app:isolated`: a 6-panel board lands as one stack in order with notes and an
  overview; Fabio's look.

## Phase 2: Launch kit - `user-ux`

- [ ] `/mpi-flow-graphics` (tile + hero), agent knowledge page (playbook 07), UNRELEASED roster line +
  entry for the LTX 2.5 release (written when the gate comes off, umbrella MPI-1267).

## Decided (Fabio 2026-10-24, took every pick)

- **Reference pictures are OPTIONAL: zero or many.** With none, panels are drawn from the words alone
  (text-to-image arm, e.g. FLUX.3 / Klein t2i, cast consistency then rests on the planner's
  descriptions; bench it in Phase 0 too). With some, the edit arm (up to 10 references).
- Panel count: default 6, slider 3-12.
- Show the plan before drawing: an editable box of panels that Enhance fills.
- The numbered overview is made automatically at the end.
- Phase 0 go-ahead given (local runs, ~20-30 min GPU under the lease; no money).

## Not in v1

Sections, a video per section, Generate for missing sections, Keyframes, Cosmo tools for stacks/notes
(none exist today: a later card if Cosmo should call this Flow).

## Plan Drift

- 2026-10-24: brief's open questions answered by the brainstorm (stack + notes, not a new card kind).

## Verification

**Verify mode:** user-ux

Phase 0 and the end of Phase 1 need Fabio's eyes; the driver self-verifies with unit tests.
