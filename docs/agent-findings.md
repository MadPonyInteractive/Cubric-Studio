# In-app agent — findings from live use

What the agent was SEEN to do in Fabio's own app, why, and where the fix lives. The contract
(tools, routes, events, loop rules) is [agent-chat.md](agent-chat.md); this file is the
evidence behind it. Started 2026-09-20 on Fabio's instruction: *the agent is permanent, so what
we learn about it must outlive the card that found it.* Raw rounds, logs and sidecars:
`.agents/mpi-kanban/tasks/MPI-817/validation.md` and `MPI-774/validation.md`.

**Add a finding only when it was observed live or measured, and say which.** One entry per
root cause, not per symptom. A finding whose fix shipped stays: the *why* is the point.

## The rules that every finding so far obeys

1. **The agent only knows what a tool description or a tool result told it.** Every gap below
   is a fact that never reached it, which it then filled with a plausible guess. Fix the gap at
   the data source (`GET /connector/models`, a result line, a NOTE), not with a prompt line.
2. **Remove rather than add** (Fabio, 2026-09-20). Limits go in tool descriptions and tool
   results. A system-prompt rule is the last resort, and it LOSES to a plausible deduction:
   see "i2i over edit".
3. **A refusal beats a silent fallback.** A run that cannot do what was asked must fail with a
   code naming what it needs. Every "success" that did nothing cost a generation and a lie.
4. **The file is the truth, the chat is a claim.** What ran is in the card's sidecar
   (`Media/.meta/<itemId>.json`: prompt, modelId, operation, `generationSettings`). `app.log`
   logs an agent job's TYPE only. Diagnose from the sidecar, never from what the agent said.

## Findings

### The chat asserts what the file contradicts (three times in one day, 2026-09-19)

- **`{started: true}` read as "done".** A fire-and-forget `generate` told the model nothing
  about the outcome; it narrated success. Fix: `wait: true` awaits the same promise and returns
  the output, and a finished unwaited run lands in `_notes` for the next turn.
- **`fetch failed` on a render that had finished.** Node `fetch` drops a response whose headers
  take over 300 s whatever `AbortSignal` says; `/connector/generate` holds its response for the
  whole render. A 337 s clip landed on disk, the agent was told it failed and re-ran it. Fix:
  `agentTools.mjs` `_post` uses `node:http`. Same trap, NOT fixed: `services/llmEngines.mjs`
  gives Ollama a 600 s timeout through `fetch`, so its real ceiling is 300 s.
- **"The Krea 2 result is already a cartoon"**, about an `ill-anime` picture. It knew the
  pinned model and nothing about what made the picture in front of it, so it welded the two.
  Fix: `modelId` rides on the generate result and renders as `t2i_004 (made by ill-anime)`; a
  bare ref is stated to be of UNKNOWN origin, because without that sentence the gap gets filled.

### A flow's inputs never reached it (2026-09-19)

Outpaint ran 70 s and handed back the same shape: its `crop` step was invisible to
`_listModels` (it built params from `kind === 'box'` only) and `_submitFlow` had no crop branch.
Flow entries also carried no media roles, so it borrowed `inputImage` from another model and
learned the real role from a refusal. Fix: a crop step rides as `frame: {param, role, ratios}`,
flows map through `mediaRolesFor`, and no frame on a crop flow is `FRAME_REQUIRED` (a ratio the
picture already has is `FRAME_UNCHANGED`). **The model names a RATIO, the app does the
arithmetic** (`frameRectForRatio`), the same reason `BOX_NOT_MEASURED` exists. MPI-816 is the
same family: flow fields advertised as `{id, label}` with no type, default or options.

### Names that sound like values (2026-09-20)

"Redo it in 1K" got 1664x960: `qualityTiers` reached it as bare names (`high`, `very_high`)
with no pixels, so it matched on how a name sounds. Fix: `namedParamsFor` returns `tierSizes`
(`{tier: {ratio: 'WxH'}}`). Same shape: a ratio snap was narrated as "the picture's own shape"
until `snapNote` said it is the NEAREST of the only ratios the op makes. Expect this wherever
an enum is advertised without its meaning. `denoise` is the open case: see below.

### It writes negation into prompts (2026-09-19)

Three rounds lost to "not drawn", "never leaves the holster": a text encoder has no "not", each
phrase ADDS its noun. Then "no camera roll" on H3, where the word it needed (`arc`) sat beside
`roll` in the guide. Both guides had the rule filed under ONE op. Fix: a
`### Say what is there, never what is not` section in `docs/agent/models/krea-2.md` and
`minimax-h3.md`. Two guides with the same defect says the rule is not per-model. Related: **the
agent never reads the enhancer recipe** (zero references in `agentLoop.mjs` / `agentTools.mjs`);
it reads `docs/agent/models/*.md`. Two prompt-knowledge bodies per model; the vendor-skill
merges of 2026-08-17 landed in the one it never sees. That is MPI-817 Phase D.

### "The last one" answered from a note, not the list (2026-09-19)

Asked for "the image you used for the last video", it used the one before: `list_cards` had the
right row 1, but a project note described an older "base image" and the Cards rule ranked a
card over memory only for what RAN. Fix: "last / latest / the one before" is the list's order,
newest first; a note never answers it. Sidecar `createdAt` is the ground truth here, mtimes are
not (a peer pass had rewritten them all).

### It promises what it cannot do (2026-09-20)

"I'll let you know when it lands": it never speaks first, a late result reaches it only when
the user writes again. Fix: one sentence in the Duration rule. The real fix is a wake on drain,
designed and NOT built (`MPI-817/plan.md` § Phase C): the loop broadcasts a drained
conversation, the RENDERER posts the wake only if that project is open, because a dispatch
lands in whatever project is OPEN and only the renderer knows which that is.

### What never landed leaves no trace (2026-09-20)

He closed the app on two running clips and asked it to requeue them: honest answer, useless
answer. A conversation lives in memory only and an unfinished clip has no card. He REFUSED
persisting the conversation and an archived digest (do not re-offer either). Built his shape:
`_trackUnfinished` writes the agent's own `generate` args to the project note
`unfinished-generations.md`, removed on landing, stamped with the error code otherwise. No new
tool, no new route, no prompt text.

### The step cap ended a good turn on a false error (2026-09-20)

"Too many tool calls, try a simpler request", one second after it had dispatched the clip.
Fix: `MAX_STEPS` 8 → 16, and the call after the last round carries NO tools plus a one-call
system line (`OUT_OF_ROUNDS`, never stored), so the turn ends in the model's words.
**Unproven:** no live turn has reached 16 rounds, so the tools-off call has never run against a
real provider. One that rejects tool history with no `tools` param will show as
`ENDPOINT_ERROR`.

### It picks i2i over edit, and its own rule lost three times in one night (2026-09-20, OPEN)

"Make it anime": `ill-anime` `i2i`, then krea2 `i2i` twice, `krea2Edit` only when HE said so.
The Model rule says changing an existing picture is the edit task. "Anime" matched ill-anime's
NOTE, the rule lets a note outrank a rank, and ill-anime has no edit op. **Why edit is "more
truthful" (his word): an edit op keeps the pixels whatever the words say, i2i repaints from the
WORDS.** `edit_001` came out right although its own prompt was wrong. Home for the fix is data:
`modelConstants/modelPriority.js` NOTES has no `:i2i` entry. Not built.

### It does not know denoise exists (2026-09-20, OPEN, approved)

Zero hits for `denoise` in `agentLoop`, `agentTools`, `agentDispatch`, the connector. Both krea2
i2i runs carry `controlState.op.denoise: 0.3`, a value from the app. Default or his last slider:
NOT checked. Without it a model with no edit op cannot be asked for a faithful restyle at all.
Approved shape: a named param on every op with the slider (i2i, upscale, detail), advertised by
`describe_model`, meaning "the higher it is, the more the image changes". Never a prompt line.

### Its eyes were wrong and nothing recorded what they said (2026-09-20; the record is BUILT, the eyes are OPEN)

Source: rider upright, both revolvers raised, pointing UP. Its prompts: "leaning forward",
"pointing outward at her sides". No ComfyUI activity during `agent.describe`, so the describer
was the remote vision model; whether IT misread or the chat model paraphrased is unprovable,
because a look's text lives in server memory only. Also every waited still is looked at TWICE
(`settle()` auto-looks, then the model calls `look` on the same file). Built 2026-09-21: **a
look is kept once in the card's sidecar** (`look: {text, at}`, `AgentLoop._lookOnce`), read
first, vision model only on a miss; it dies with the card. Only the unprompted description is
kept: a question, a crop or a box is a different answer and always goes live. The read is off
disk; the write goes through `POST /project-media/agent/update-meta` because that route owns the
per-sidecar write queue, and `storeLook` never creates a sidecar. **Consequence to remember when
the describer changes: a wrong description is now wrong forever**, until the field is cleared.
Wider principle he named: the sidecar is the home for card-scoped derived information.
Still open, approved: TEST vision models on that real picture before recommending one.

## What worked, and should be copied

- **Item ids without a second id space.** The model knows `ref`; routes take item ids. The
  showing version's `itemId` rides in the card's `files` map and `generate`'s output, and tools
  resolve it from the same `_images` entry `look` uses. A ref with none is `NOT_A_CARD`.
- **One row builder.** The visible set: the renderer answers GROUP IDS only, the route builds
  rows off disk with `agentCards.cardsByIds`. No second copy of the row shape or the filter.
- **A queue, not a refusal.** A message typed mid-answer used to be `BUSY` and lost; it queues
  on `agentSessions` and runs next (MPI-840). The wake design reuses that queue.
- **One message, several tools, no list first.** A video chip → `gif.make` → `gif.cutout`
  passed live in one turn once the box took a video BY REFERENCE (url + item id, never bytes).
- **Limits in tool descriptions hold.** "The agent cannot judge motion in a GIF" lives in the
  GIF tool descriptions and needed no prompt line.

## Deferred on purpose

Masks, detailing, workspace tools: agent v2, through skills (Fabio, 2026-09-20). Do not start.
Batch ask (`cards: [ref...]`) waits on three answers from him, recorded in the plan.
