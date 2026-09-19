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

## Left for Fabio

Ask for a long, multi-beat action ("she fires, the bull keeps running, she comes to a stop
as the camera swings behind her") and check the clip is long enough to contain it, and that
the agent quotes the length the file actually has. **A run from before this session's fix
proves nothing**: the duration never left the agent, so any clip it produced was the 3 s
default whatever it said.
