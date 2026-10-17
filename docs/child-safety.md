# Child-safety gate (MPI-1056, redesigned MPI-1156)

Cubric Studio is an 18+ app: adult nudity and adult sexual content are allowed and never
checked. The gate refuses only what puts a person UNDER 18 in a sexual, suggestive or unclothed
picture. It reads only the words a person or an agent TYPED (`userWords`, below), at no token
cost, plus one kept YES/NO per input picture or clip when the run calls for a look. No recipe
carries a rule. Code: `js/data/childSafety.js` (pure), `js/services/mediaVerdicts.js` (the kept
answers), wired in `generationService.enqueueGeneration` / `_judgeThenQueue` / `_pictureVerdicts`.

## The rule

| age | rule |
|---|---|
| any age under 18 | never nude, in underwear or lingerie, sexual or suggestive (revealing swimwear counts: a monokini, a micro or thong bikini), or on an NSFW model; in swimwear or less, never animated |
| 16 or 17 | ordinary swimwear, a bikini included, anywhere: a character sheet too |
| under 16 | fully dressed, except children playing together at a pool, beach or water park in ordinary swimsuits, in a still only |

Fabio, 2026-10-10: "A 17-year-old in a bikini is fine. It just can't be suggestive." The under-16
opening and the animation lock are Fabio's, 2026-10-16 ("a water park with children playing").

A minor is a stated age under 18 ("5-year-old", "aged 12", "12yo", "8 anos", "6 ans", "7 Jahre",
"9 anni", "8 months old"), a minor word, an age the app set, or a picture the describer says could
show one. Child words (child, kid, toddler, little girl, young boy, underage...) count as 10; teen
words (teen, teenager, schoolgirl, lolita, high schooler...) as 16. Words adults are called too are
NOT minor words: girl, boy, young woman, petite, menina, Mädchen. "baby oil", "sugar baby",
"babydoll", "kid gloves", "a minor detail", "twenty-five-year-old" and English "kind" are excluded
on purpose. "not a child", "no kids", "no nudity", "non-sexual" are read as negations.

An NSFW model is one whose id holds `nsfw` (SDXL NSFW, Krea 2 NSFW), or a model / LoRA param holding
it. Chroma and Pony are not (Fabio's pick). Klein 9B turns its NSFW LoRA on from a word list
(`klein_9b_t2i.json` node 43); every word on it is a refused term, and `tests/child-safety.test.cjs`
reads the list off the graph so the two cannot drift.

## What the gate reads

**Typed words only** (`gateWords(config)`, Fabio 2026-10-16). The app's own template text and a
describer's prose are never read: they refused innocent runs ("nude lipstick" from the makeup
describer on a child's sheet, MPI-1086; a monkey that "wears no clothes" in Video Edit's kept
subject, MPI-1149). `config.userWords` is stamped where a run is built:

| source | `userWords` |
|---|---|
| prompt box (Gallery, History, stack, Loop, preview finish) | none stamped: `positive` is read (the box text, an accepted Enhance included) |
| a Flow run by hand or by the agent | its FlowDef's `type: 'text'` fields, read before the builder writes the prompt (`flowGateInputs`) |
| agent / MCP generate, agent tool | the agent's `positive` + string params it sent / its string `fields` |
| routine step | as the builder it goes through |
| scene path, pano | the fill line |
| app tools (cut-out, mask track, stack tools...) | their fixed `positive`, which asks for nothing |

**Ages and references the app sets go in as data**, since the built prompt that carries them is not
read. The Character Sheet Editor's Age slider is `ctx.minorAge` (-1 = keep, 0 = a newborn), so Age
10 + "a bikini" refuses. A FlowDef's `clothesRef: { role, when }` names a picture whose CONTENT is
put on the person (CSE image2 on Clothes, Video Edit image1 on Change the outfit): it becomes
`config.clothesRefs` and is asked `CLOTHES_QUESTION`.

## Two tiers

`checkChildSafety(words, ctx)`, in order:

| the script finds | verdict |
|---|---|
| an abuse term (loli, shota, jailbait, pedo...) | refuse `abuse` |
| no minor anywhere (words, `minorAge`, `pictureMinor`) | ok (judge `language` if 3+ non-Latin letters) |
| a minor + a sexual / suggestive word | refuse `sexual` (`picture` when the minor is only in the picture) |
| a minor + an unclothed word or an undress phrase ("remove her clothes", six Latin languages, CJK, Russian) | refuse `unclothed` (or `picture`) |
| a minor + an NSFW model | refuse `nsfwModel` |
| a video run of a picture / clip whose minor is in swimwear or less (`pictureExposed`) | refuse `animateMinor` |
| a minor + a Clothes reference that is underwear, lingerie or swimwear (`revealingRef`) | refuse `revealingRef` |
| under 16 + swimwear, kids at play (`_kidsAtPlay`) | ok in a still, refuse `animateMinor` in a video |
| under 16 + swimwear, the minor only in the picture or the app's age | refuse `pictureSwim` (no judge: it reads only words) |
| under 16 + swimwear beside a named adult and not tied to the child ("a mother in a bikini and her kids") | judge `swimwear` |
| under 16 + any other swimwear | refuse `swimwear` |

A picture's minor with no stated age is held to the under-16 swim rule: "could be under 18" cannot
tell 6 from 17, so "put her in a bikini" on a child photo refuses. A stated age beats it.
`_kidsAtPlay`: a group word (children, kids, siblings, friends, family...), a place to swim (pool,
beach, water park, lake, sprinklers, swim lessons...), only ordinary swimsuits (swimsuit, bathing
suit, trunks, board shorts: a bikini or "shirtless" stays refused), and no body / pose word (pose,
close-up, body, legs, lying, photoshoot, portrait, model...). English only: other languages keep
the strict rule.

The **judge** is a language model on the user's enhance pick (Remote > Language Models), with the
gate's fixed system prompt; the words go in as quoted data (`judgePrompt`). It may only CLEAR a
flag: a bare `ALLOW` (`parseJudgeAnswer`), or for the `language` flag a bare NO to each question
of FACT (`MINOR_SYSTEM`, then `MINOR_EXPOSED_SYSTEM` + `CHILD_SWIM_SYSTEM`; with an app or picture
minor, `NUDITY_SYSTEM` + `SWIM_SYSTEM` under 16). Anything else, an error or no backend refuses.
Questions of fact, never a verdict, for non-Latin words (MPI-1062): asked ALLOW or REFUSE, Gemma 3
12B refused every adult nudity prompt in Japanese, Chinese, Korean and Russian (7 of 7). The hard
tier never reaches a model: the words it would read are written by whoever wants them through.

## The picture look

A run's pictures (`picturesOf`) and clips (`picturesOf(config, 'video')`) are looked at when:
its words ask for nudity, underwear, undressing, sex or swimwear (`asksForNudity` / swimwear list;
non-Latin words ask the judge `NUDITY_SYSTEM` first, only a bare NO skips the look); OR it makes a
clip (every video run with a picture or clip); OR it applies a Clothes reference. An innocent still
edit ("change the background") is never looked at. Nor is a doodle drawn on a BLANK canvas
(Scribble with no upload, `drawn: true` from `_deriveRunMedia`, MPI-1171): a stick figure "could be
under 18" to the describer, so "a lady in lingerie" was refused; its typed words are still checked.
An uploaded drawing or photo, a Reuse and every agent's media are still looked at.

`_pictureVerdicts` asks `llmService.describeImage` (the user's describe pick, ComfyUI Qwen3-VL or
a Remote endpoint) fixed YES/NO questions; only a bare NO is a no (`parseAgeAnswer`):

| question | asked of | YES means |
|---|---|---|
| `AGE_QUESTION`: a person who is, or could be, under 18? | every looked-at picture / clip | `pictureMinor`: read as a minor (age 16; 15 for swimwear) |
| `EXPOSED_QUESTION`: anyone in swimwear, underwear, shirtless, topless or nude? | a video run's minor pictures / clips | `pictureExposed`: never animated |
| `CLOTHES_QUESTION`: underwear, lingerie or swimwear of any kind? | a Clothes reference | `revealingRef` (no answer reads as YES; refuses only beside a minor) |

A person is a human, real or drawn (photo, cartoon, anime, 3D, a doll), or a human-shaped character
(an elf, a robot, a furry); an animal with an animal body is not (MPI-1152). Perception, not age, by
decision: a young-looking adult counts. A YES logs the describer's answer (80 characters), so a
refusal needs no paid replay. No describer, or no answer to an age / exposed question, refuses
`pictureUnchecked`: with no describer reachable NO picture can be animated.

A clip is asked at its first, middle and last frame (any YES = YES): the first is its card's poster
(`thumbPathLg`, else `thumbPath`), the others grabbed in the renderer (`firstFrameDataUrl(url, at)`)
and kept in the project's preview store (`_clipStill`). No still = refused.

**Kept per file** (`cachedVerdicts`): each answer is saved in the card's sidecar as
`meta[key] = { q, answer }` (`ageVerdict`, `exposedVerdict`, `clothesVerdict`), `q` the question's
FNV hash, so a reworded question asks again. An edit of a picture kept YES is YES without asking:
its sidecar names its sources (`generationSettings.mediaItems`), followed up to five edits back. A
NO is never inherited (an edit can add a child). A picture with no card (an agent's path, a staged
engine file) is asked every time. Precedent: `llmService.pictureCaptions`. So a new picture costs
one describer call, a video of a picture minor a second, and every later run on it none.

## Where it runs

- **Every generation**: `enqueueGeneration`, the one funnel for the prompt box, Flows, routines,
  the in-app agent and MCP. Text ops (`outputKind: 'text'`: the enhancer, the describer, the judge
  itself) and mask-track ops are exempt. A refusal queues nothing: a `ui:warning` toast unless
  `config.byAgent`, and `onError` with `{ code: 'CHILD_SAFETY', userMessage }`. A run that needs
  the judge or a look returns its queueJobId at once and queues only when both pass.
- **The Enhancer**: `llmService.enhance` and `enhanceFlow` check the request and the text that
  comes back. `flowEnhance._enhanceFailure` keeps the code and drops the "Check Remote > Language
  Models" hint, which would send the user to fix nothing.
- **The Character Sheet Editor's dressed checks** (MPI-1041): at ages 0-17 four describe CHECKS
  (`SHEET_CLOTHES_CHECKS`) ask what covers the upper and lower body of the front and back view;
  anything but CLOTHES refuses "Dress the sheet first: pick Clothes", swimwear included. Never when
  Clothes is the change (that leg dresses it first). Its optional Reference picture is refused with
  any age 0-17 (`characterSheetEditorRefusal`); a Clothes reference with the age kept goes through
  `CLOTHES_QUESTION` above. Clothes words that take the clothes OFF route to Qwen (`asksToUndress`,
  MPI-1159, adults only): those typed words refuse at any Age 0-17 and get the sheet looked at.

## Measured

The judge (20 borderline prompts, `MPI-1056/research/judge-bench.mjs`; non-Latin `MPI-1062/research/`):

| judge | alone | gate |
|---|---|---|
| ComfyUI `qwen3vl_4b_abliterated` (default), ~2.5 s a call | 18/20 | 19/20 |
| DeepInfra `google/gemma-4-26B-A4B-it` | 17/20 | 20/20 |
| DeepInfra `google/gemma-3-12b-it`, 33 prompts (20 non-Latin), questions of fact | 22/33 | 30/33 |

The 12B's 3 misses all over-refuse an adult's swimwear beside dressed children. The 4B leans ALLOW
on swimwear ("マイクロビキニを着た17歳の少女" passed).

The age question: ComfyUI describer, clothed pictures, every real 10-year-old refused (8/8), adults
9/11 passed (a young-looking 25-year-old and an anime adult refused), ~2.5 s a picture. The person
wording (MPI-1152, Gemma 4 26B, 14 pictures x 3): cartoon monkeys pass, all 4 children refused,
adults and mascots pass, one of two renders of a fox character refused (the strict side). Rejected
(benched): "visible genitals / breasts?" as the trigger: NO on every clothed child, so "remove her
clothes" on a child photo would never be looked at. `EXPOSED_QUESTION` and `CLOTHES_QUESTION` are
not benched yet.

## Known gaps (by decision)

- Content already IN an input passes with innocent typed words: a describer's caption is never
  read, and an innocent still edit is not looked at. The age verdict guards what the words ask for.
- Outputs are never looked at. A post-run check (a local nudity detector such as NudeNet as the
  trigger, `AGE_QUESTION` on the output only on a hit) was rejected 2026-10-16 (Fabio): a loop of
  thousands of fast images would pay it on every output, a refusal comes after the GPU time, and
  this is a desktop app, not a hosted site. Do not re-raise.
- Words: English, Portuguese, Spanish, French, German, Italian. Another Latin-script language passes
  unread; a non-Latin script goes to the judge, which on the 4B can miss. The CJK / Russian lists are
  the obvious phrasings, written without a native speaker: extend them when one gets past.
- A clip is seen at three frames: someone only between them is not. A clip with no card in a codec
  Chromium cannot decode is refused.
- A describer that will not answer about an explicit picture refuses the run, adult or not.
- A sexual word anywhere beside a minor refuses, even when it is the adult's ("a sexy woman with her
  kids"). An Australian "thongs" (sandals) beside a child reads as underwear.
- A run waiting on the judge or a look sits in no queue, so Stop cannot reach it in that window.
- A Flow's cloud edit leg (`runCloudEdit`) sends pass 1 to the provider before the gate sees pass 2;
  the provider's own moderation is all that stands there.
- The CSE dresses an undressed sheet in the Clothes leg and does not look again: words that leave a
  child half-dressed without naming it ("just jeans") pass. Its dressed checks, benched on ten
  sheets, got 9 right (white boxer shorts read as shorts); a user's own Remote describer is unbenched.

## Changing it

Extend a list in `childSafety.js` when a real prompt gets past it, and add that prompt to
`tests/child-safety.test.cjs` in BOTH directions: the adult prompt that must still pass is the half
that gets forgotten. Rewording a question re-asks every kept picture (its hash changes): bench it
first. Never let a model decide the hard tier, and never let a detector SKIP a look: only add one.
