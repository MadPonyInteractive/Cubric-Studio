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

## Step 3, tagged tiers: sweep I (2026-10-11, after the sentence-6 audio clause was removed)

ALL PASS 12/12. Every picture line right: bare `the cat, the main subject at the centre of the scene` x3; medium
Picture 2 `setting: the room ...` x3; directed `the cowboy who wears a hat and shoots` (and variants); overlong
Picture 2 `setting: the cliff ...` x3. Overlong run 3 still wrote an `<Audio 1>` picture line; harmless now, the sheet
builder drops it, and the tag is also in the scene. Output: session 5cddf24b scratchpad `step3-full-i.txt`.

## Step 2b: describe step (2026-10-11, session d6d1c356)

`node tests/llm-service.test.cjs` 32/32: `testEnhanceSeesThePictures` proves a kept `look` is reused, a card without
one is described once and kept (describer recorded), a file with no card is described and kept nowhere, the captions
sit before the Attached line, and Seedance r2v (no `seesPictures`) describes nothing. recipe-registry, enhance-control,
enhance-overlay, agent-corpus, ingredients-sheet green; eslint clean on the six files.

Seen tiers (untagged prompts + captions), same engine/judge, 3 runs/tier:

| Sweep | Wording | Tagged 12 | picnic | swapped | What failed |
|---|---|---|---|---|---|
| J | SEEN block at the top, whole looks | 11/12 | 0/3 | 3/3 | guinea pig `prop:` 3/3; overlong `<Audio 1>` only on its own line 1/3 |
| L | + animal = character, look check added | 12/12 | 0/3 | 0/3 | picnic ignores captions ("the forest"); swapped drops the hamster's looks |
| M/N (picnic) | + captions cut to two sentences; + "dressed as" note | - | 0/3 | - | guinea pig `prop:` 3/3 |
| probe | 5 input variants, 2 runs | - | - | - | trigger = "Dressed as a fireman": removed -> character 2/2. Order pig-first -> right 2/2 |
| probe 2 | 4 system patches, 3 runs | - | - | - | removing the "wearing <Picture n>" cue fixes the role; SEEN bullet LAST in PART 1 + a "dog dressed as a pirate" example fixes role 3/3 AND brings the looks |
| O | that patch | 12/12 | 2/3 | 0/3 | swapped: "prop: the firefighter's helmet" 2/3 (fixated on the outfit) |
| P (seen only) | + "first WHAT the picture is, never one thing it wears" | - | 3/3 | 2/3 | helmet as prop 1/3 |
| Q | + medium check: Picture 2 must not be "setting: the rocking chair" (O had it 2/3, passing) | 12/12 | 3/3 | 2/3 | swapped run 1 `the guinea pig dressed as a fireman who watches the sunset`: role right, user's words not the look's |

| R | Q's text | 12/12 | 2/3 | 2/3 | picnic: "vibrant" copied from the look (now stripped in `withReferences`); swapped: user's words |
| in-app 1 | real `enhance()` in my app:isolated on a COPY of "X2.3 references", Ollama gemma-4-abliterated-12b, kept looks, order woman/hamster/valley | - | 3/3 | - | none: roles and looks right x3 |
| in-app 2 | same, order valley/woman/hamster | - | - | - | hamster `prop: the firefighter's helmet` 2/3; one run wrote an extra paragraph |
| probe 3/4 | shuffled orders | - | - | - | NOT position: the hamster reads as "the fireman costume" whenever it is not Picture 1, because "guinea pig" != "hamster". A 3-picture example made it WORSE. The near-name sentence ("guinea pig" for a hamster is the same subject; a costume is never a separate picture): roles 11/12 over four orders |
| S | + near-name sentence; + `seen-shuffled` tier | 12/12 | 2/3 | 3/3 | shuffled 1/3: helmet-as-prop 1, two lines without the looks; picnic: "the forest" once. Roles wrong: 1 of 21 runs |

Sweep Q picnic lines (Fabio's live ref2v_004 text): `<Picture 1> the woman with tan skin and long, wavy hair that
transitions from dark brown to magenta pink` / `<Picture 2> the small, tan-colored hamster in a miniature yellow
firefighter's helmet` / `<Picture 3> setting: the wide valley filled with thick white mist`. Outputs: session d6d1c356
scratchpad `{j..q}-*.txt`, probes `probe.mjs`, `probe2.mjs`.

## Step 2c: fixed roles (2026-10-12, session 2b4da86d)

`node tests/llm-service.test.cjs` 32/32: `testEnhanceSeesThePictures` now also proves the kind is asked once per picture
without a kept `lookKind`, kept beside `look` (top-level `lookKind`), reused when kept, and the reply's role words are
rewritten (`setting:` dropped off an animal, added to a place). recipe-registry, agent-corpus, ingredients-sheet green; eslint clean.

| Sweep | Wording | Tagged 12 | picnic | shuffled | swapped | Roles wrong | What failed |
|---|---|---|---|---|---|---|---|
| T | S + app-written roles (`withRoles`) | 12/12 | 3/3 | 1/3 | 3/3 | 0/21 | shuffled: 3 lines with the user's words, not the look ("the woman who sits on a towel"); one passing run described the hamster as "a miniature yellow firefighter's helmet" (role now right, subject wrong) |

Output: session 2b4da86d scratchpad `t-full.txt`.

| in-app 3/4 (eye1/eye2) | real `enhance()` in my app:isolated (:50687), kinds asked of Ollama `qwen3-vl-abliterated:4b` | - | - | - | - | valley 3/3 WRONG | the first kind question called the valley (a small hiker in it) `person`, so the app STRIPPED the right `setting:`. A wrong kind is worse than none |
| kind probe | 3 questions x 7 stills x 2 runs, same 4B describer | - | - | - | - | - | q1 (old) valley=person 2/2; q3 ("setting of a scene") horse character sheet=place 2/2; **q2** ("what is this picture OF ... place even when small figures appear in it") **14/14 right** -> shipped. `kindprobe.mjs`, `kind1.txt` |
| in-app 5/6 (eye3/eye4) | q2 kind question, kinds re-asked (copy cleared) | - | - | - | - | **0/18** | kinds kept right (001 place, 004 person, 003 animal). Descriptions still the enhancer's: order valley/woman/hamster 1/9 lines wrong subject ("a miniature yellow firefighter's helmet" for the hamster); order hamster/woman/valley ignored the captions 3/3 - valley line "setting: the forest where the picnic takes place" (user's words, wrong place), woman thin 2/3 |
| Fabio eye test 1 (2026-10-12, his app, DeepInfra Gemma 4 26B describer) | woman/hamster/forest, "In the forest the woman ... hamster dressed as a fireman ... squirts her with water" | - | - | - | - | 0/3 | roles right, kinds kept right. NEW: output opened with the recipe heading "PART 1 -- PICTURE LINES" (lands in the scene text). Woman line carries her PICTURE's pose and place ("sits on the turquoise swimming pool, facing the camera and smiling") against a forest scene |

### Step 2d: the app writes the whole picture line (Fabio 2026-10-12: "yes, app writes the whole picture line")

`registry.withPictureLines` replaces `withRoles`: each captioned picture with a kind gets `<Picture n> [setting:|prop:] <lookName>`; one with a kind but no name keeps the enhancer's words under the app's role; an undescribed one keeps the enhancer's line; copied `PART n` headings dropped; the enhancer keeps only the scene. recipe-registry 11/11 (new `testAppWritesThePictureLines`), llm-service 32/32, agent-corpus, ingredients-sheet green, eslint clean.

| Probe | Question | 4B qwen3-vl (14) | gemma4:12b (14) | Notes |
|---|---|---|---|---|
| kind2 | "kind: phrase", no example | format broken 4/14 ("kind: phrase phrase: ...", no kind on 3) | 14/14 format, kinds right but horse sheet = animal (same line as person) | phrases good on both; no pose |
| kind3 | "kind: phrase" + two example answers | format 14/14; valley = "person: a person in a red jacket" 1/2 | format 14/14; horse sheet = animal | combined question loses the kind accuracy |
| kind4/kind5 | KIND_QUESTION (one word) then NAME_QUESTION(kind) | **14/14** kinds, phrases looks-only | 12/14: man-on-horse sheet = "a dapple-grey horse" 2/2 even with "riding or holding an animal" (no role word either way, the man is lost); hamster once "chinchilla" | shipped. Known edge: a rider + animal picture may be named by the animal on a larger describer |

| Sweep | Wording | bare | medium | directed | overlong | picnic | shuffled | swapped | Notes |
|---|---|---|---|---|---|---|---|---|---|
| T2 | app-written picture lines (`withPictureLines`, harness names) | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | medium run 1 "setting: the rocking chair near the fireplace": no captions on that tier, so the enhancer's own line (O had it 2/3). In-app LTX r2v always captions; only a failed describe reaches that path. No `PART` heading in 21 outputs |

| in-app 7/8 (eye5/eye6) | app-written lines, kinds + names asked fresh of Ollama qwen3-vl 4B, Fabio's picnic text | hamster/woman/valley: **9/9 lines right**; woman/hamster/forest (Fabio's eye-test order): **9/9 right**. Looks only (no pose, no pool), identical across runs (asked once, reused), no heading, scene reads clean under them |

| Fabio eye test 2 (his app, DeepInfra Gemma 4 26B describer) | woman/hamster/forest, squirting-hose text | lines: role right x3, looks-only; "a light brown RAT" (look says hamster), woman "green ribbed bodysuit". SCENE: "sits on the edge of the pool" (pool from the look gist sent as caption), "medium shot from behind" against "facing the camera". Fix: send the enhancer the looks-only `name`, not the look gist; anchor NAME_QUESTION on the look's first sentence |
| kind6 | NAME_QUESTION told the kept look's first sentence ("call the subject what that description calls it") | hamster = hamster 2/2, woman looks-only, no pool | hamster = hamster 2/2 (was guinea pig / chinchilla cold), woman looks-only; horse sheet still "a grey dapple horse" | probe bug: valley got a video card's look (file matched by name inside another sidecar), not the app path |
| T3 | enhancer captioned by the looks-only `name` (not the look gist) + app-written lines | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | **ALL PASS 21/21**; "pool"/"swimming" in 0 outputs |
| in-app 9/10 (eye7/eye8) | names as captions + look-anchored NAME_QUESTION, 4B describer, Fabio's squirting-hose text in his order + valley order | **18/18 lines right**, hamster = hamster, no pool anywhere, scene "from the front ... faces the camera". Only nit: "Young woman" capitalised -> `tidyName` now lower-cases any leading capital (test updated) |
| Fabio eye test 3a (his app, DeepInfra Gemma 4 26B, sidecars NOT cleared) | hamster/woman/BEACH, "facing the camera ... picnic at the beach ... hamster steals one of her oranges" | lines right x3 (beach fresh `setting:`), "rat" = stale kept name. SCENE: "medium shot from the side" against "facing the camera"; "Low sun through pines" + "worn wool" copied verbatim from the r2v SCENE RULES examples (the beach look: midday sun, no pines); invented "slow zoom". Fix (session 5cb627a7): examples removed, a stated facing kept (facing the camera = from the front), no undescribed camera move, sentences 6/7 un-fused; tier `seen-beach` with `scene` checks |
| T4 | the three scene fixes + `seen-beach` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 + beach 3/3 | **ALL PASS 24/24** (scratchpad 5cb627a7 t4-full.txt). Beach read by eye: "from the front"/"facing the camera" 3/3, "camera remains static" 3/3, no pines/wool. Left: invented ground "grass" (2/3) and "dirt" (1/3) on the beach, a smile at the theft (his text gives no reaction) |
| Fabio eye test 3b (his app, 26B, reload unsure, sidecars NOT cleared) | beach/woman/hamster ("Amsterdam" = dictation), chase + his shouted line | **Fabio: "no fail"**. Lines right x3, hamster matched despite "Amsterdam", dialogue his own. "from the side" right for a chase (he gave no facing). Open: crash zoom + side track he did not ask for, 8 sentences - only a fail if the reload had loaded the camera rule; he re-runs after Ctrl+R |
| Fabio eye test 3c (after Ctrl+R, "hamster" typed) | same chase text | Fabio: rat naming does not matter (sidecars stay). 7 sentences; "slow push-in" picked unasked -> **Fabio: the enhancer picks the camera when the user gives none** (r2v sentence 5/dos/donts rewritten; static check dropped) |
| T5 | enhancer-picked camera | 3/3 x7 + beach 3/3 | **ALL PASS 24/24**; beach "from the front" 3/3, camera "pans slowly" (allowed). By eye: beach run 2 dropped the theft, judge 2/2/2 -> new check "the theft happens" (regraded T4 3/3, T5 2/3) + sentence 3 "every event ... completed" |
| T6 | + sentence 3 "every event ... completed" | bare 3/3, medium 2/3, directed 3/3, overlong 1/3, picnic/shuffled/swapped 3/3, beach 3/3 | 21/24. Beach theft 3/3. Medium run 1 "setting: the chair" (uncaptioned tier, same as T2; the app always captions). Overlong: "his voice" without `<Audio 1>` 2/3 - the Full D flake |
| T7 | same prompt, `--tier overlong` | overlong 3/3 | tag kept 3/3 ("he speaks in the voice of <Audio 1>"): 4/6 on this prompt, the known 12B flake, not the sentence-3 clause |
| T8 | final prompt (sentence 3 + enhancer-picked camera + facing kept + no borrowed examples) | 3/3 x8 | **ALL PASS 24/24** (scratchpad 5cb627a7 t8-full.txt). Read by eye: beach "from the front" + theft 3/3; overlong tag kept 3/3. Seen-picnic scene says "forest"/"canopy" over the valley picture: the user's own word, the line is right. **Step 3 done: T4 + T8** |
| Fabio render ref2v_007 (his app, LTX Balanced, 3 s, 960x512, seed 775436841, audio on, T8 beach prompt) | **FAIL (Fabio: "big fail")**. Frames 0-~18: a garbled web-page collage (the bench's `lay_woman_tags` failure), then the right beach, woman, hamster in helmet + sunglasses. Action: she HANDS an orange to the hamster, no theft. ref2v_001-006 (all 5 s) open clean. Suspects for the collage: 3 s length (only differing setting), seed. Action: one-clause theft + "She smiles at the camera, her gaze steady" (006's working prompt spelled the theft in beats + a surprised reaction). Fix: sentence 3 spells the main event as 2-3 beats; sentence 4 no calm smile at the camera through the event; beach check for it. Sweep T9 queued |
| T9 / T10 (local 12B) | + beats + no calm smile (+ "keep the user's verb" for T10) | T9 22/24 (medium 2/3, beach 2/3); T10 beach-only 1/3 | the 12B writes "grabs ... pulls it toward its own position" and a relaxed, smiling woman: no theft on screen. Fabio OK'd testing on the model users run (DeepInfra Gemma 4 26B, up to 5 sweeps ~8 cents) |
| D1 (DeepInfra Gemma 4 26B) | same | 7 tiers 3/3, beach 0/3 | beach fails were MY CHECKS: the 26B plays the theft out ("grabs an orange and runs toward the turquoise water", "freezes, eyes widening", "gasps and reaches") but the theft regex wanted steal/snatch; "scurries from the side" tripped the viewpoint check. Fixed: theft = named, or grab/pull/take + away/off/runs in one sentence (regraded: D1 2/3, T9 0/3, T10 1/3, T8 3/3); viewpoint read from the scene's first sentence only. "Keep the user's verb" REMOVED (fights the beats rule) |
| D2 (DeepInfra Gemma 4 26B) | final prompt | 3/3 x8 | **ALL PASS 24/24** (scratchpad 5cb627a7 d2-full.txt). Beach by eye: front 3/3, "grabs the orange, and retreats toward the shoreline" / "runs away into the dunes", woman "eyes widen ... reaches out a hand" / "freezes", high sun, no grass/pines. Spent: 2 sweeps, ~3 cents (estimate, 24 enhancer calls each) |
| Fabio renders ref2v_008 (5 s) + ref2v_009 (3 s), his app, 26B Enhance, chase text | **Fabio: "it worked"**. Both open clean (frames read: no collage), identity holds (woman, hamster in helmet/sunglasses/uniform, beach). "Big rat" with a rat tail = the stale kept name, known. Collage = 1 of 9 clips, not length: seed-bound (bench saw the same), noted in `docs/models/ltx/reference-ingredients.md` |
