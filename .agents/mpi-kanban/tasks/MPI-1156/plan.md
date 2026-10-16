# MPI-1156 - Child-safety gate reads only typed words; picture and clip verdicts cached per file

## Goal

Stop app-written words refusing innocent runs, without loosening the rule (docs/child-safety.md § The rule).
Today the gate keyword-matches EVERY string param (`configTexts`): Flow template text (`Input_Mannequin_Prompt`
"no clothes"), the describer's prose (`refMakeup` "nude lipstick", `Input_Kept`), enhancer output. Each new Flow
adds a new false refusal and a per-Flow patch (MPI-1086, MPI-1149). Fabio, 2026-10-16: redesign, not patch.

## Design (Fabio's idea + the three refinements he approved, 2026-10-16)

1. **Typed words only.** The gate's text tier and the "look" trigger read `config.userWords`: what a person (or an
   agent) typed. Set at the edges: the prompt box (Enhancer output included: the user accepted it), each Flow's
   free-text fields (from its FlowDef `fields`, not the built prompt), an agent's / MCP prompt, a routine step's
   prompt. Flow template text and describer prose are never read. A test runs every Flow's own text through
   `asksForNudity` with empty user words: none may ask for nudity (the mannequin line's "no clothes" gets
   reworded or the test names it as a non-request).
2. **App-set ages feed the gate as data, not words.** The Character Sheet Editor's Age slider writes "a
   10-year-old" into the BUILT prompt; reading typed words only would let Age 10 + "a bikini" through. Any field
   that sets an age passes it as `ctx.minorAge` (the FlowDef marks the field), and the text tier treats it as a
   stated age.
3. **Every input picture gets one age verdict, cached per file.** On first use as an input (never on import),
   `AGE_QUESTION` is asked once and saved in the media's sidecar with the question's hash; a changed question
   asks again. An edit of a picture marked YES inherits YES (its sidecar names its source). A picture YES =
   a person who could be under 18 = the text tier treats the run as stating age 16: nudity, underwear, sexual
   refused; an ordinary bikini allowed (same as a stated teen). Clips: first, middle and last frame (any YES =
   YES), cached the same way. No describer = refused, as today.
4. **A reference whose CONTENT is applied (Clothes) gets one fixed question**, not prose matching: "Is the
   clothing in this picture underwear, lingerie or revealing swimwear? YES or NO", cached per file. YES on a
   run whose target is a minor (typed age, `ctx.minorAge`, or a picture YES) refuses.
5. Unchanged: the Enhancer's own request/response check, the judge (questions of fact for non-Latin words),
   the Character Sheet Editor's dressed checks, the NSFW-model rule, the hard abuse terms.

## Phases

### Phase 1 - map (read-only)
Every place a config is built before `enqueueGeneration`: prompt box, flowService (fields vs built prompt),
agentDispatch / connector, routines, cloud edit leg. Which FlowDef fields are free text; which set an age.
Where the media sidecar lives and is written (`.meta`), and how an edit's sidecar names its source.
**Verify:** a table in this plan: source -> where `userWords` gets set. DONE below.

#### Phase 1 result (2026-10-16, Explore agent, spot-checked: MpiPromptBox.js:2619, llmService.js:1181, agentDispatch.js:732/802)

| source | config built | userWords = |
|---|---|---|
| Prompt box (Gallery, History, stack, Loop re-fire) | `MpiPromptBox.getRunPayload` 2608-2640 (`positive: _enhanced?.positive ?? positiveValue`) -> MpiGalleryBlock 1687/1776, MpiGroupHistoryBlock 2594-2624 | the run's `positive` (box text, Enhancer output accepted; Describe-into-prompt / Reuse text in the box counts as typed: the user sees it). Style / LoRA triggers are added in-graph, never in `positive` |
| Preview finish (stage 2) | MpiGalleryBlock 845-859, 988-1037 `positive: frozen.prompt` | the frozen prompt (it was the box's) |
| Flow hand run | `MpiBaseFlow._collectInputs` 3529 -> `flowService.js:498-513`; builder overwrites `positive` at 679-683; describe answers merged 711 | the values of the FlowDef's declared `type: 'text'` fields, read BEFORE 513 (`run`/`snapshot` 422-423). An Enhance target's value counts only when the user wrote it |
| Agent / MCP generate | `connector.js:569/648-668` -> `agentDispatch.buildGeneration` 645-736 | `input.positive` + any string `injectionParams` the agent sent (the agent typed them) |
| Agent tool | `buildTool` 775-804 | string `input.fields` |
| Agent Flow | `buildFlow` 1228, `resolveFlowFieldValues` 1343, enhancer merged 1394/1425 | text fields at 1343, before the enhancer merge. NOTE: no `byAgent` on this config (an agent Flow refusal toasts) |
| Routines | `routineRunner._fillStep` 101-107 -> `routineDispatch.submit` 113-133 -> the three builders above | as those builders (saved step words + run-time inputs) |
| App-only runs (stack tools, video/image tools, cut-out, dictation, mask track, sceneConvert) | various | none (empty) |
| Scene path / pano | scenePathVideo.js:101, panoVideo.js:91 | `fillLine` only |
| Cloud edit pass 1 | flowService.js:784 `runCommand` direct | outside the gate (known gap, unchanged); pass 2 at 902 is gated |
| GIF, concat, composite | server routes, never queued | not gated (CPU work, no model) |

Ages set by a field: only the Character Sheet Editor `Input_Age` (flowsRegistry.js:1793, -1 keep, 0 newborn).
MiniMax `Input_Voices` "Child" is audio: out of scope.

Picture verdict cache: precedent `llmService.pictureCaptions` (1181-1246): path -> card id -> sidecar
(`/load-meta-batch`), describe if missing, write back via `/project-media/:id/update-meta`. Same for the age verdict:
`meta.ageVerdict = { q: <question hash>, answer }`. An edit's sidecar names its source in
`generationSettings.mediaItems[].url` (generationService.js:1424-1436): inherit a YES. A picture with no card
(an agent's absolute path, a data URL, a staged engine path) is asked every time (rare; no cache).
Clip frames: no client helper grabs a frame at a time; server `extractVideoThumb(input, out, {atSeconds})`
(services/ffmpegThumb.js) exists with no route. Phase 4 adds one route or a client seek.

### Phase 2 - gate core (`js/data/childSafety.js`)
`userWords` + `ctx.minorAge` + `ctx.pictureMinor` / `ctx.revealingRef` in; `configTexts`/`lookTexts`/`SKIP_KEY`/
`KEPT_KEY` retired. **Verify:** `tests/child-safety.test.cjs` rewritten to the new inputs, both directions
(adult passes, minor refused), incl. the MPI-1086 makeup case and the Age-slider bikini case.

### Phase 3 - set `userWords` at every edge
**Verify:** one test per edge that a config reaching `enqueueGeneration` carries the typed words and nothing else.

### Phase 4 - cached verdicts (pictures, clips, Clothes reference)
Sidecar field, question hash, inheritance on edit, clip frames. **Verify:** unit tests with a stub describer:
asked once per file, reused, re-asked on a new question, inherited on edit.

### Phase 5 - docs + eye test
docs/child-safety.md rewritten (≤200 lines). **Verify mode:** user-ux. Fabio: Makeup picture on the child sheet
(passes), "nude" typed on the child sheet (refused), Age 10 + "a bikini" (refused), an adult photo "remove her
clothes" (passes), a child photo "remove her clothes" (refused), a Video Edit on a child clip.

## Verification

**Verify mode:** user-ux (Phase 5); Phases 1-4 auto (`npm test`).

## Current State

2026-10-16 (session "New character sheets 36"): Phases 1-4 DONE, plus Phase 4b Fabio added in-session. Picture answers
are kept per card in its sidecar by `js/services/mediaVerdicts.js` (`cachedVerdicts`, `meta[key] = { q: hash, answer }`):
`ageVerdict` (AGE_QUESTION, inherited through `generationSettings.mediaItems` up to 5 edits back), `exposedVerdict`
(EXPOSED_QUESTION, asked only on a video run once a picture is a minor), `clothesVerdict` (CLOTHES_QUESTION). Wired in
generationService `_pictureVerdicts` -> ctx `pictureMinor` / `pictureExposed` / `revealingRef` -> `childSafetyGate`;
`pictureCheck` deleted. A look now fires on nudity OR swimwear words, on every video run that takes a picture or clip,
and on a Clothes reference (FlowDef `clothesRef: { role, when }`: CSE image2 on Clothes, Video Edit image1 on Change the
outfit; `flowGateInputs(flow, run, mediaItems)` -> `config.clothesRefs`; userFlows FLOW_KEYS allows it). Clips: poster,
then `firstFrameDataUrl(url, 0.5 / 1)` (proven in Chromium). Phase 4b rule (Fabio): under 16 may wear ORDINARY swimsuits
when the words name children as a group at a place to swim, no body/pose words, stills only (`_kidsAtPlay`); a video
run of it, or of a picture of a minor in swimwear or less, refuses `animateMinor`. A picture minor with no stated age
meets the under-16 swim rule (`pictureSwim`). NOTHING COMMITTED yet.
NEXT: Phase 5: docs/child-safety.md rewrite (still describes configTexts/lookTexts/runPrompt/pictureCheck; add the
opening, the lock, the cache), then Fabio's eye test (list below + a water-park still, the same as a clip, animating a
child photo in a swimsuit).

2026-10-16 (session "New character sheets 37"): Fabio's in-browser agent notes assessed (no change: face-age models are
non-commercial / fail on drawn people, a person detector that SKIPS a look fails open; one real gap logged in the doc:
outputs are never looked at). docs/child-safety.md rewritten to the shipped design (191 lines). NEXT: Fabio's eye test.

## Completed

- Phase 1: config-source map (2026-10-16).
- Phase 2: gate core + tests (2026-10-16).
- Phase 3: userWords at every edge; old scan + runPrompt deleted (2026-10-16).
- Phase 4: cached verdicts (pictures, clips 3 frames, Clothes reference) + 4b swim opening and animation lock (2026-10-16).

## Remaining Work

Phase 5.

## Plan Drift

- 2026-10-16 Phase 2: `configTexts`/`lookTexts`/SKIP_KEY/KEPT_KEY NOT deleted yet: they are `gateWords`' fallback until
  Phase 3 sets `userWords` at every edge (deleting them first would open the gate). Text tier now also refuses
  UNDRESS words and CJK/Russian nudity next to a minor ("a 12-year-old, remove her clothes" passed before). A minor
  only from ctx + swimwear under 16 is refused, never judged (the judge reads only words). New `SWIM_SYSTEM`
  question for non-Latin words + a ctx minor.
- 2026-10-16 Phase 3: the unstamped default is `[positive]`, not empty: the prompt box (Gallery, History, stack, Loop,
  preview finish) needs no stamp, and an edge someone forgets still reads its positive (no worse than before).
  Consequence Fabio approved with "typed words only": a describer's caption of the INPUT is never read, so Video Edit
  on a clip whose kept subject the describer calls "a young boy, naked" with innocent typed words now queues (the old
  child-safety-gate test for it was removed). The input's age is Phase 4's picture verdict (age 16 => typed undress
  refused); content ALREADY in the input with innocent typed words passes even after Phase 4 - raise at Phase 5.
- 2026-10-16 Phase 4: Fabio added Phase 4b in-session ("a water park with children playing"): the narrow under-16
  swimwear opening and the animation lock. Consequences picked by the agent, stricter than the plan: a picture YES
  meets the UNDER-16 swim rule when no age is stated (the plan said age 16, which let "put her in a bikini" on a
  6-year-old's photo through); swimwear words now trigger the look; the Clothes question covers any swimwear, not only
  revealing; every video run that takes a picture or clip is looked at (one describer call per new file, then kept).
  Non-Latin words keep the strict under-16 swim rule (the opening is English-only, no new judge question). A run
  with no describer reachable can no longer animate any picture (pictureUnchecked).
