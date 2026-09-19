# MPI-820 Validation

## The bug, confirmed from the workflow file

`comfy_workflows/minimax_h3_fl2va.json` node 212 bakes `Input_Duration: { "int": 2 }`, and
`duration` was in NO named-param set, so `agentDispatch` never injected the key. Every
agent video therefore ran 2 - which `MpiH3Length` snaps to **56 frames = 2.333 s**, below
the 124-362 trained range - while the app's own slider read 5. Fabio hit it live on
2026-09-19: he set 3 s in the pinned panel and the card came back "2S".

## What shipped

- `duration` is a named param end to end: route -> resolver -> `Input_Duration`.
- Precedence matches turbo: explicit ask > the project's saved value > three-layer default.
  So the **pinned panel's own duration now runs**, which was the half that was lying.
- An unset duration resolves to **3 s** instead of falling through to the baked 2.
  Fabio's own call (2026-09-19), against the model: 5 s (124 frames, 5.167 s) is the first
  value inside H3's trained range and `docs/models/h3/README.md` recommends it, but he took
  the shorter one anyway - 5 s is a long wait, and the wait that bites is not the total, it
  is how long before the FIRST latent shows, which also grows with clip length. 3 s is
  73 frames / 3.042 s, still below the trained range. It is a FLOOR, not the answer: the
  agent is told to work the length out from the action described and raise it when the
  action needs the room, so this only stands when nobody had an opinion. It is the global
  `PROMPT_CONTROL_DEFAULTS.duration`, so it is also the slider's opening value - one
  default, deliberately, rather than a panel and a dispatch that disagree.
- The answer reports the REAL length. H3 only lands on a 17k+5 grid, so a 6 s ask is 141
  frames = 5.875 s; `durationSeconds` and `frames` ride on the result and the prompt tells
  the agent to quote those, never the ask.
- Out-of-trained-range REPORTS rather than refuses: a short clip is legitimate.
- The agent judges the length itself (Fabio: "the agent should be able to figure out how
  long the video needs to be"). Duration is the one setting the Settings rule tells it to
  decide rather than leave at a default - count the beats in the action described.

## Checks

| Check | Result |
|---|---|
| `tests/agent-duration.test.cjs` (new, 9 cases) | pass |
| `npm test` | **1408 pass, 0 fail** |
| `npm run lint:components` | clean |

The last test pins our JS copy of the frame grid against `ComfyUi-MpiNodes/h3.py`'s own
constants and compares both snap implementations over 400 frame counts. The node is the
authority and does the snapping at graph time; the JS only PREDICTS it so an answer can
state the real length, and a change there that is not mirrored here would silently make
every reported duration wrong. It skips itself when the sibling repo is absent (CI).

## The second half, found 2026-09-19 before Fabio's pass (session ea603cb9)

Everything above was true and none of it could reach a user. `duration` shipped through the
route, the resolver and the injection - and **the agent's own `generate` tool never carried
the key**. `services/agentLoop.mjs` did not declare `duration` in the tool schema, whose
`additionalProperties: false` meant the model could not legally emit it, and the body
builder never read `args.duration`. So the Duration rule at `agentLoop.mjs:702` told the
agent to judge the clip length for itself and then gave it nowhere to put the answer: every
agent video fell to the 3 s default, while the chat quoted the length the agent had decided
on. The `{started:true}` failure shape again - the chat says one thing, the file is another.

Nothing in the 1408 tests could see it: `agent-duration.test.cjs` asserted the resolver and
the frame grid, which were both already correct. Found by reading the file.

Fixed: the key is declared (with its 1-30 range in the description) and forwarded beside
`turbo`.

### The test is on the class, not the key

`every named param the connector accepts is declared AND forwarded by the agent tool` reads
`NAMED_PARAM_KEYS` out of `routes/connector.js` and asserts each one against the `generate`
tool block in `agentLoop.mjs`. The route's accepted set is the contract; the tool must carry
all of it. The next named param cannot repeat this, which one assertion on `duration` would
not have bought.

Proven red before the fix, not assumed: both regexes run against `git show
HEAD:services/agentLoop.mjs` returned `declared: false`, `forwarded: false`.

| Check | Result |
|---|---|
| `tests/agent-duration.test.cjs` | **10/10** (9 + the new plumbing test) |
| `npm test` | **1415 pass, 0 fail, 1 skipped** |
| `npm run lint:components` | clean |

## The THIRD half, found live on Fabio's own clip (2026-09-19, session a018e069)

His duck-and-pony run, the first live pass of 74be51fd. The chat said *"medium quality,
about 6 seconds"*; the card badge read **`IMAGE TO VIDEO · 3S`**. The sidecar
(`Cowgirl on a Bull/Media/.meta/990cbfa0-….json`) settles which one was true:
`Input_Duration: 3`, `duration: 3.042`, and the agent's own project note says `~6s`.

**Why.** `POST /connector/generate` sat between the two halves already fixed. `f124f535`
added `duration` to `NAMED_PARAM_KEYS` and to the doc comment, and to **none of the
hand-written lines under them**: it was never destructured off the body, never copied into
`named` for validation, never spread onto the job `input`. Being in the key list made the
validation block FIRE, so the route looked like it handled it. Accepted, then dropped. The
resolver got `undefined` and correctly fell to the 3 s default.

Both earlier "end to end" claims in this file were wrong about the route, and the class test
above could not see it: it asserts the key list against the TOOL, by regex over source.

**Fixed structurally, not by adding the sixth line.** `named` and the job `input` are now
BUILT FROM `NAMED_PARAM_KEYS`, so a key in the list cannot be left out of the forwarding
again. `styleSelect`'s label-to-index override still lands after the spread.

**The test drives the real route.** It mounts `routes/connector.js` on an ephemeral port,
subscribes to `/connector/jobs/stream` as the renderer would, posts a generate carrying
`ratio`, `qualityTier`, `turbo` and `duration`, and asserts each one on the job `input` the
stream delivers. Red on the pre-fix code on exactly one key (`'duration' … undefined !== 6`,
the other three passing), green after. Outside agents on the CLI skill hit the same route,
so `cubric-vision-generate/SKILL.md`'s `duration` row was also untrue until now.

### And the agent's judgement was wrong in the other direction

Fabio's verdict on the clip: **3 s was right and 6 s "would actually be a fail"**. The drop
saved the run by accident. With the pipe fixed the agent's 6 would have run, so the Duration
rule is recalibrated in the same change, with his two anchors verbatim: reins + rear + one
shouted line = 3 s with room to spare; 6 s is that PLUS the pony breaking into a run with
the camera following. The old rule pushed long twice over ("every added beat costs seconds",
"ends mid-action … is worse than one a little too long"); it now says budget less than the
first instinct, names what actually earns seconds, and calls an idling clip a failure too.
It also closes the say-vs-do gap for an unwaited step: before the result is back the agent
knows only what it ASKED for, and must say so rather than state a length as fact.

| Check | Result |
|---|---|
| `tests/agent-duration.test.cjs` | **11/11** (10 + the route test), the new one red before the fix |
| `npm test` | **1439 pass, 1 fail, 1 skipped**. The one failure is `tests/flow-defer-commit.test.cjs`, which reads `MpiBaseFlow.js` - MPI-822's uncommitted in-flight work, not a file this card touches |
| `npm run lint` | clean |

### LIVE, after his restart (2026-09-19 19:21Z): the long half passed

Same duck, now *"…and the horse starts running and the camera follows"*. The agent said **"I
asked for 6 seconds"** - the new rule's wording, so the restart took - and this time the file
agrees: sidecar `i2v_006` carries `Input_Duration: 6`, `frameCount: 141`, `duration: 5.875`,
and the sampler logged `42 latent frames (141 video)`. 337.5 s. A six-frame sheet shows his
anchor holding to the second: rear and shout fill 0-2.3 s, the gallop with the camera
trucking alongside runs from 3.5 s to the end.

One round was lost to `GUIDE_NOT_READ`: it had read `minimax-h3:i2v`, the gate wanted
`guide:minimax-h3`, it read that and resubmitted. The gate working as built; the chat shows
"Starting generation" for the refused attempt too, which reads as two runs.

### The SHORT half passed too (19:40Z), and that closes the clip check

*"Just make the duck look in the distance … it should be a very short video."* The agent:
**"I asked for 2 seconds"**. Fabio, watching it land: *"2 seconds was really enough. The
whole ask is in the video."* So the recalibrated rule moved it in the right direction on the
first try: 6 s for reins + rear + shout + gallop with a following camera, 2 s for one turn
of the head, both chosen by the agent, both true to the file.

**His verdict covers both halves.** What is left on this card is not the clip check: see the
ratio-narration item on `tasks/MPI-817/checklist.md` (the agent offered a 768x1024 video H3
cannot make), which came out of this same run and is not a duration fault.

## Left for Fabio

**DONE 2026-09-19, both halves, his own words above.** The text below is the original ask,
kept for the record. The card can close on this evidence at the next `mpi-end-session`.


Ask for a long, multi-beat action ("she fires, the bull keeps running, she comes to a stop
as the camera swings behind her") and check the clip is long enough to contain it, and that
the agent quotes the length the file actually has. **A run from before this session's fix
proves nothing**: the duration never left the agent, so any clip it produced was the 3 s
default whatever it said.
