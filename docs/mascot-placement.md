# Mascot placement: where every clip lands

> **Moved here from MadPony-Identity on 2026-09-20.** That repo made the artwork; where it goes in the app is this repo's business. The roll records it links to (prompts, seeds, what failed and why) stayed behind.

For the agent who wires the MPI-78 mascot clips into Cubric Vision / Cubric Studio 2.0. Asked for by Fabio 2026-09-15 so
the integration does not have to be reverse-engineered from the roll records. Code pointers were read off Cubric-Vision
on 2026-09-14/15; re-grep before editing, lines move.

**Split of work (Fabio, 2026-09-16).** Nothing is integrated into Cubric-Vision from this repo: the wiring is done in the
Cubric-Vision repo. This repo decides where each clip goes, when it shows and how it behaves, and cuts the clips out and
converts them to alpha WebM (rule 10) once the app can. The wiring card is Cubric-Vision **MPI-777**
(`.agents/mpi-kanban/tasks/MPI-777/`), blocked on the cut-out tooling (Vision MPI-757) and an alpha WebM export.

## Who is who

- **Studio** is the agent and, from 2.0.0, the app itself. It owns the agent chat box and the app-wide spots: engine
  starting, landing with no projects, update available.
  **In the agent chat he is called Cosmo** (MPI-843, 2026-09-20): same mascot, same clips, different name, and he is
  the only one of the five who speaks there. This document says Studio throughout; the agent-panel code says Cosmo.
  Note what that means for a Failed state — **Studio/Cosmo has no Failed clip**, see the gaps in
  `mascot-gif-manifest.md`.
- **Per operation** (the brief's mapping, not re-confirmed since): image -> **Vision**, video -> **Video**, audio -> **Audio**,
  prompt tools -> **Prompt**. A per-job spot (Generating card, toasts, gallery, search, cancelled) plays the mascot of the
  operation involved. "op's" in the map below means that mascot.
- Today the app ships ONE set, `assets/mascot/{idle,greet,happy,waiting,logo}.png` (Vision's). Per-operation sets do not
  exist in code yet.

## Where the clips are

- Vision project `C:\Users\Fabio\Documents\Cubric Vision\Projects\Cubric Studio Mascots\`, files in `Media/`. Every card is
  named Mascot + clip (e.g. "Studio idle 2"); the file name belongs to the app (`ref2v_*`, `i2v_*`), listed below.
- Prompts and roll records: `mascot-generating-card.md`, `mascot-states.md`, `mascot-scenarios.md` in this folder.
- 768x768, 24fps. 3s clips are 73 frames, 5s clips are 124.
- Clips sit on flat light grey. The background comes off in the app: GIF Maker turns a clip into a GIF card, and the
  SAM3 cut-out (by name, with video tracking) cuts its frames into alpha (Vision MPI-757). Not BiRefNet: it takes too much
  VRAM, worst on batches. Standing clips keep a thin floor bar under the feet, which Fabio removes in the app.

## Playback rules

1. **One shared frame.** Every state clip and every full-body scenario clip of a mascot opens and closes on the same rest
   frame, so swapping one clip for another at a clip's END never jumps. Swap only at the end, never mid-clip. The
   Generating card clips were rolled on a different route: each loops on itself, but they do not share that frame.
2. **One shared clip queue, not per-spot code** (Fabio, 2026-09-16). Any spot that chains clips (the landing crew, the
   prompt box ledge, the agent chat, toasts) uses one utility: a pool of clips per state, random or in order, looping or
   not, swapping at the end of a clip. Several clips for one state (3 idles, 2 greets, 2 happy): when one ends, play a
   random next one.
3. **Play to the end.** The landing hero crew's timers cut greet at 1.5s and happy at 1.4s; these clips need their full
   3s.
4. **Static stays static:** OS notification icon (`main.js:306`, happy PNG), titlebar and About logo (`index.html:19`,
   `MpiAbout.js:44`).
5. **Float latent window: getting ready, then working. Nothing else.** No happy or Done clip: the media lands at the same
   moment, and an animation cannot hold it back (tried before, Fabio 2026-09-15).
6. **Gallery peek clips are head-only** and the head is cut by the clip's bottom edge: place them bottom-aligned on an
   edge of their container. Their main home is the top edge of the prompt box (see below). They play once and leave, so
   they do not have to loop. They need their own CSS to sit behind that edge.
7. **Waiting spots use the working clip.** The user is the one waiting; the mascot does the work. There is no separate
   waiting clip and none is wanted.
8. **Only Studio stays on screen.** Every other mascot comes and goes.
9. **No walking on the landing.** The crew stands in a row, so a walk would bump them into each other.
10. **Format: WebM, VP9 with alpha** (Fabio, 2026-09-16; set in Vision MPI-766). Not GIF.
11. **A hover plays a transition first** (Fabio, 2026-09-16). A clean swap only happens at a clip's end, so a hover
    would wait up to 5s behind an idle. Instead a short transition (about 1s, like a ninja smoke puff) plays over the
    mascot at once, the clip swaps underneath at the transition's densest moment, and the new clip plays as it clears.
    The app picks one of the mascot's three at random. Rolled 2026-09-16; see below.

## Transitions (Fabio 2026-09-16, rolled the same day: `mascot-transitions.md`)

Overlay graphics, not mascot clips: they sit on a layer above the mascot, and the clip swaps underneath at the
transition's **swap time**, the moment it hides the mascot most. Record the swap time for each one.

- **Three per mascot, 15 in all, each 1s.** In practice 0.917s (22 frames), the nearest length H3 can make; see
  `mascot-transitions.md` Settings.
- **Text to video on plain MiniMax H3** (`minimax-h3`), not H3 Reference: there is no picture to start from. Same settings
  as the H3 Reference rolls (`mascot-generating-card.md` Settings: 1:1, quality medium, 768x768, turbo on, seed random), except
  the duration. Check that H3 accepts 1s before queueing; if not, report back rather than rolling longer.
- **Solid black background**, the same in every clip, and the same flat cartoon style as the mascots: thick outlines,
  flat colours.
- **Self-contained:** the whole effect stays inside the frame from the first frame to the last and never touches an edge,
  so nothing is cut off when it sits over the mascot.
- **Kinds:** a smoke puff and a cartoon explosion, plus one more per mascot (ninja smoke is the reference feel). Colour each
  set in its mascot's palette.
- Rendered on black and composited with screen blending, so the black drops out and soft smoke edges survive (a SAM3
  mask would harden them). Light, bright effects only: screen blending cannot show dark smoke.

## The landing hero crew (Fabio, 2026-09-16)

Today (`js/shell/heroCrew.js`, stills): idle at rest, greet on hover, a random greet every 3.2s, happy on click.

- **At rest:** each mascot plays its idles from the shared queue (rule 2), in random order. Idles only, until Fabio picks
  other clips that suit the spot.
- **Hover:** a transition, then a greet picked at random from the mascot's two (rule 11).
- **Ambient:** the random greet stays, and plays to the end (rule 3).
- **Click:** a transition, then a happy clip picked at random from the two.
- The scenario clips (cancelled, heads up, search, peek) belong to their spots and do not play here.

## The prompt box ledge (Fabio, 2026-09-16)

The top edge of `MpiPromptBox` (`js/components/Organisms/MpiPromptBox/`) is a floor or wall for the mascots.

- **Agent mode: Studio sits there the whole time.** Studio is the agent and the user's companion, so it is on screen
  whenever the prompt box is in agent mode. It is the only mascot that stays. It plays the agent set: idle x3 at rest,
  agent listening, agent thinking, agent answer ready.
- **Other modes: the selected model's mascot visits.** Image model selected -> Vision; video model -> Video. When the
  model is selected, the mascot peeks up over the edge once, then goes. After that it shows up again now and then.
- **Where a visit lands:** a random spot inside a fixed zone over the prompt box, most likely the centre, clear of the
  image chips and the operation buttons.
- **Flows:** mascots can appear in Flows too. That is the only place Audio can show up today. Which Flows, where and on
  what trigger is not decided yet.

## The landing while a pod connects (Fabio, 2026-09-17)

While the app connects to a RunPod GPU, the hero crew leaves the landing and Studio alone stands between a laptop and a
computer tower, trying to join their two cables and never managing it (`mascot-connecting.md`). Wide 21:9 loops (1536x640,
except screwdriver at 1920x768) across the crew band.

- **Loops, cycled** (rule 2's shared queue): every loop opens and closes on the same frame, and the app plays them in
  turn with one of Studio's transitions between each (rule 11), for as long as the connect takes.
- Studio never connects in any loop, so none of them lies about the pod's state.
- **On connect success** (the app's existing event; `heroStats.js` ~248 is where the connecting phase ends): a Studio
  transition plays at once over the current loop (rule 11, no waiting for the loop to end), **Studio connected** swaps in
  under it and plays once (5s, ends with the lights on and his arms up), then a transition brings the crew back. The
  transitions are the app's existing overlays; only the clip is generated. A failed connect is open: the 1:1 Studio
  failed clip does not match this scene, so a transition straight back to the crew for now.
- The laptop, desk, tower and cables are part of the clip and are cut out with Studio.

## Spot map

| Spot | Code today | Trigger | Clip | Mascot |
|---|---|---|---|---|
| Generating card, big and centred before latents (`mascot-idle`) | `MpiGalleryGrid.js` ~1518-1570 | job started, no preview yet | getting ready, looping | op's |
| Generating card, small bottom-right while the preview streams (`mascot-cooking`, 22% of card width) | same | preview frames arrive | working, looping | op's |
| Float latent window | `main/float-latent.html` ~166-171, `js/shell/floatLatentBridge.js` | per lane | getting ready, then working (rule 5) | op's |
| Landing hero crew | `js/shell/heroCrew.js` | at rest / hover and every 3.2s ambient / click | idle x3 queued / transition, then greet x2 / greet x2 / transition, then happy x2 (see above) | all five |
| Toasts | `MpiToast.js` ~141-157 | info / success / warning ("Heads up") / danger | idle / happy / heads up / failed | op's, Studio for app-wide messages |
| Landing, no projects | `js/shell/projectUI.js:207,228` (greet PNG) | empty project list | Studio landing no projects, looping | Studio |
| ~~Prompt box ledge, agent mode~~ — MOVED to the agent panel (MPI-843: the prompt box has no agent mode) | — | — | — | — |
| Agent panel crew ledge — **BUILT 2026-09-22, reworked same day** (MPI-777 Phase 4A) | `MpiAgentChat.js` `__crew` (panel only), a fixed 112px row whose floor is the composer's top rule, plus a 20px `studio/logo` in the header | rest / `_setWorking`; guest on `generation:started` → `complete`/`cancelled`/`error` | FULL STANDING FIGURES, feet on the rule (Fabio rejected head peeks here as "too boring" — peeks belong over the prompt box, 4B). Cosmo runs a `mascotClipQueue`: idle pool `idle-1..3` + `agent-listening`; `agent-thinking` loop while working (cut in); `agent-answer-ready` once after; `greet` on panel open; `happy-1` when a job completes. The queue exists only while the panel is seen. Guest: the NEWEST generation still running (any source), its `working` clip looping, name + progress verb + elapsed timer, sliding in over 280ms. Feet = each clip's lowest alpha row, constant per clip: 557 for idle/greet/happy/agent states, working 570/528/584/580 (vision/video/audio/prompt) — `_FEET` in the JS, applied as `--feet` | Studio + op's (`getCommandAccent`) |
| Prompt box ledge, other modes | `MpiPromptBox` top edge, central zone | model selected, then now and then at random | gallery peek, once | selected model's op |
| Flows | not decided | not decided | not decided | any; Audio's only home today |
| Gallery scope empty | `MpiGalleryGrid.js:1979` (idle PNG) | scope has no cards | gallery peek (rule 6); open again now the ledge is the peek's home | op's |
| Filter with no match | not built (planned, Vision MPI-749, small mascot) | filter returns nothing | search no results | op's |
| Starting engine screen | `MpiStartingComfy.js:24` (idle PNG) | ComfyUI booting | Studio engine starting, looping | Studio |
| Model Library queued install | `MpiTileSheet.js:172`, `MpiModelManager.js` (waiting PNG) | install waiting its turn | working (rule 7) | the model's op |
| History peek | `MpiGroupHistoryBlock.js:459,746` (waiting PNG) | waiting | working (rule 7) | op's |
| Landing agent slot — **SHIPPED 2026-09-22** as Cosmo peeking over the block’s top rule, the composer on the line | `MpiAgentChat.js` `__ledge` (standalone only; the 48px still and the “Ask me anything” label are gone) | rest / `_setWorking(true)` | `studio/peek` looping (the HEAD PEEK - the one clip drawn for a ledge: measured rows 443-619, bottom edge always cut, and frame 29 returns to frame 0 so it loops), crossed to `studio/agent-thinking` while the agent works — two stacked looping clips, no queue and no timers. The peek is bottom-aligned to the rule; the standing clip is hung by its own head row instead, because bottom-aligning a standing figure shows feet | Studio |
| Job cancelled | no visual yet; event `generation:cancelled` (`js/events.js:198`) | user cancels a job | job cancelled | op's |
| Update available | `js/services/updateChecker.js:183` dialog, `MpiSettings.js:53` plate (no mascot today) | newer version found | Studio update ready | Studio |
| Landing, connecting to a RunPod pod | `js/shell/heroStats.js` ~209-250 (remote phase `connecting`, same emit as `statusBar.js`) | remote connect starts | Studio connecting loops (21:9), cycled with transitions, replacing the whole crew until the connect resolves (§ The landing while a pod connects) | Studio |

Not animated, by decision (2026-09-15): mode switch (Tab snaps straight into the next mode, no moment to fill), long idle
(covered by rule 2). Parked: the hero crew passing a high five down the line, which needs sequencing code and an 8:5
frame.

## Clip index

**Delivery format as of 2026-09-20.** Every unarchived clip below also exists as a GIF card in the Vision project, made
at 10 fps, original size, looping forever. The 87 mascot GIFs carry a background-free entry (BiRefNet, 1px shrink via
`adjust {"grow": -1}`); the 19 transition GIFs do not, and must not — they composite with CSS screen blending on black,
which a mask would harden (see § Transitions). Cards are marked so they can be filtered: **square = cut-out,
triangle = transition**. GIF alpha is 1-bit, which costs nothing on flat vector art with thick outlines and would have
been fatal on the transitions' soft smoke.

The final app format is still VP9 alpha WebM, pending an export in Cubric-Vision; the GIFs are the reviewable stage.

**Generating card** (`mascot-generating-card.md`):

| Mascot | Getting ready | Working |
|---|---|---|
| Vision | `ref2v_004` | `ref2v_005` |
| Studio | `ref2v_006` | `ref2v_014` |
| Prompt | `ref2v_008` | `ref2v_009` |
| Audio | `ref2v_010` | `ref2v_015` |
| Video | `ref2v_012` | `ref2v_013` |

**State clips** (`mascot-states.md`), idles 5s, the rest 3s:

| Mascot | Idle 1-3 | Greet | Happy | Failed |
|---|---|---|---|---|
| Vision | `i2v_001`-`003` | wave `004`, say cheese `005` | hop `006`, head pop `007` | `008` |
| Studio | `i2v_009`-`011` | wave `012`, hat tip `013` | hop `014`, head pop `015` | `016` |
| Prompt | `i2v_017`-`019` | wave `020`, typing dots `021` | hop `022`, head pop `023` | `024` |
| Audio | `i2v_025`-`027` | wave `028`, ear cup `029` | hop `030`, head pop `031` | `032` |
| Video | `i2v_033`-`035` | wave `036`, director frame `037` | hop `038`, head pop `039` | `040` |

**Scenario clips** (`mascot-scenarios.md`), rolled 2026-09-15. Gallery peeks approved by Fabio 2026-09-16; **the rest not yet
reviewed**. 5s: job cancelled, search no
results, engine starting, landing no projects. 3s: the rest.

| Mascot | Job cancelled | Heads up | Search no results | Gallery peek |
|---|---|---|---|---|
| Vision | `i2v_047` | `i2v_052` | `i2v_057` | `i2v_067` (peek 2) |
| Studio | `i2v_048` | `i2v_053` | `i2v_058` | `i2v_068` (peek 2) |
| Prompt | `i2v_049` | `i2v_054` | `i2v_059` | `i2v_069` (peek 2); `i2v_064` also fine |
| Audio | `i2v_050` | `i2v_055` | `i2v_060` | `i2v_070` (peek 2); `i2v_065` also fine |
| Video | `i2v_051` | `i2v_056` | `i2v_061` | `i2v_071` (peek 2) |

Prompt and Audio peeks end higher than they start, which no longer matters because peeks play once (rule 6). The first
peeks `i2v_062`, `i2v_063` and `i2v_066` also stay in the gallery, superseded by peek 2.

Studio only: engine starting `i2v_041`, landing no projects `i2v_042`, update ready `i2v_043`, agent thinking `i2v_044`,
agent listening `i2v_045`, agent answer ready `i2v_046`.

**Transitions** (`mascot-transitions.md` § Picks, which also gives each one's swap time and size), rolled 2026-09-16, all 15
approved by Fabio the same day. The clip names differ from the rest: they are `t2v_*` (text to video). Every roll that reached the frame
edge is archived.

| Mascot | Smoke puff | Explosion | Third |
|---|---|---|---|
| Vision | `t2v_002` | `t2v_035` | camera flash `t2v_028` |
| Studio | `t2v_019` | `t2v_029` | tv switch `t2v_007` |
| Prompt | `t2v_008` | `t2v_037` | speech bubble pop `t2v_045` |
| Audio | `t2v_011` | `t2v_039` | sound pulse `t2v_044` |
| Video | `t2v_024` | `t2v_042` | film reel burst `t2v_026` |

**Studio connecting** (`mascot-connecting.md`). Reviewed by Fabio 2026-09-20: of the five 1920x768 re-rolls **only screwdriver
survived**; the rest morphed more or animated worse than the 1536x640 originals and are archived (`i2v_078`, `i2v_079`,
`i2v_080`, `i2v_082`). Plug flip `i2v_073` failed and is archived.

| Loop (8s, cycled while connecting) | File | Size |
|---|---|---|
| Sparks | `i2v_072` | 1536x640 |
| Spit out | `i2v_074` | 1536x640 |
| Laptop | `i2v_075` | 1536x640 |
| Screwdriver | `i2v_081` (snaps at f179; the agent box covers it) | **1920x768** |

On connect success, once: **Studio connected** `i2v_077` (5s, 1536x640). `i2v_076`, the 1536x640 screwdriver, is
archived now that `i2v_081` replaces it.

**The set is mixed and the two sizes are not the same shape**: 1536x640 is 2.4:1, 1920x768 is 2.5:1. Fitted into one
crew band, screwdriver's Studio lands at a slightly different size and height than the other three loops. The
transition between loops covers the swap, so this may not matter — but the integrating agent should fit on HEIGHT and
accept the width difference, not stretch either one.
