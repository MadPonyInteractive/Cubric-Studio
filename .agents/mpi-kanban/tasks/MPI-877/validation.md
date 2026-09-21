# MPI-877 — validation

Built 2026-09-21. **Not closed:** the card's verify mode is `user-ux` and the closing check
is Fabio's own re-run of the ask that exposed this. Everything an agent can verify is below.

## The ops, settled before anything reached the docs

The plan refused to let an unproven op into the agent docs. Each is now backed:

| Op | Honours a painted mask? | How that is known |
|---|---|---|
| `edit` / `kleinEdit` / `krea2Edit` / `qwenEdit` | yes | `commandExecutor.js:791` injects `Input_Mask` with no model or op check; klein / boogu / qwen / chroma / krea2 workflows all declare the node |
| `inpaint` | yes, and requires one | `commandRegistry.js:631` `requiresMask: true`; node 656 swaps in `LanPaint_KSampler` |
| `detail` | yes, and requires one | `commandRegistry.js:579` `requiresMask: true` |
| `i2i` | yes | traced in `comfy_workflows/klein_9b_t2i.json`: node 592 gates the SHARED encode (plan.md has the table) |
| `control` | **NO** | **Fabio, 2026-09-21**, answering the card's one open question directly. Not guessed, not traced round — the owner of the model said so, and that is better evidence than a trace |
| video | no | no mask support yet (Fabio) |
| GIF cut-out (`gifCutoutSam3`, `gifCutoutBirefnet`) | n/a — they BUILD masks | `commandRegistry.js:972,984` take `inputVideo` and produce their own masks; `gifJobs.js:283` collects them. Nothing is painted for them |

The GIF half of Fabio's "images and GIFs" checks out for the mask TOOL: a GIF lands as an
image card (`gifJobs.js:115`, `_landNewCard` defaults to `type: 'image'`), so the Mask tool
is available on one. Whether a masked edit of a multi-frame GIF gives a sensible multi-frame
RESULT is not proven here and is deliberately not claimed in the docs.

MPI-858 holds `routes/gifCutout.js` and `docs/masking-sam3-gif.md` under a live claim. Both
were read for this trace and neither was edited.

## The two faults, and the spec proving each

`tests/agent-mask-dispatch.test.cjs`, 9 tests. **Each fault was backed out on its own** — a
spec covering two fixes proves one otherwise:

| Backed out | Result |
|---|---|
| Fault 1 restored (dispatch carries no mask) | exit 1, **4 of 6 passing** — "a painted mask is carried through" and "a requiresMask op RUNS once the user has painted" both fail |
| Fault 2 restored (blanket `requiresMask` refusal) | exit 1, **5 of 6 passing** — "a requiresMask op RUNS once the user has painted" fails |
| Neither | exit 0, all green |

(Run at 6 tests; the three mask-slot tests were added afterwards and do not change the
above.)

## What shipped

- `js/shell/activeMask.js` (new) — a one-slot, import-free mask reader. The History
  workspace publishes; dispatch reads. Import-free on purpose: exporting the mounted block
  from `navigation.js` was tried first and dragged the whole component tree into the CJS
  require, where `MpiLevelMeter.js:2` imports `/js/utils/dom.js` — a server-absolute path
  the browser resolves and Node cannot. Every test touching dispatch died on a module three
  layers from anything it tested.
- `MpiGroupHistoryBlock.js` — publishes the reader in `setup`, withdraws it in `destroy`.
  Reads exactly as its own `run` handler does (`MpiGroupHistoryBlock.js:1828`), so an agent
  submit and a Cue press send the same mask.
- `agentDispatch.js` — `resolveMask()`, exported beside `resolveSettingsOwner` for the same
  reason that one is: the gate is code, and the spec is what stops a later edit making it a
  suggestion again. Attaches `maskDataUrl` to the dispatch config, and refuses a
  `requiresMask` op only when nothing is painted.
- `docs/agent/masking.md` (new) — the `app:masking` corpus entry. The whole localised-edit
  model: delta-only prompting, edit vs inpaint vs detail, the op table above, source size
  preserved, what is not covered yet.
- `agentLoop.mjs` — a Masking rule in the system prompt, in the shape of the existing
  Settings / Guide rules, and the Honest-limits line no longer reads as "masks are out of
  reach".
- Six model guides corrected where they taught the opposite: `flux-2.md`, `krea-2.md`,
  `chroma.md`, `illustrious.md`, `pony.md`, `sdxl.md`.
- `.claude/skills/cubric-vision-generate/SKILL.md` — NOT just an outside-agent doc.
  `agentCorpus.mjs` `skillEntries()` loads every `cubric-vision*` skill into the IN-APP
  agent's corpus, so its `MASK_UNSUPPORTED` row ("which has no agent form") was teaching the
  in-app agent the exact rule this card removes.

## Suite

`npm test`: **1736 pass, 0 fail**, 1 skipped, 1 todo. The todo is the pre-existing MPI-867
known failure in `agent-video-attachment.test.cjs`, untouched by this card.

`npm run lint` and `npm run lint:components`: both clean.

`agent-corpus.test.cjs` caught an em dash in `flux-2.md` from this session's own edit
(Fabio's copy rule, enforced on `guide:` entries). Fixed; every em dash in
`docs/agent/models/*.md` was one this session introduced.

## Not verified here

- **No real generation was run.** The mask reaching a real ComfyUI graph from an agent
  submit is proven by trace and by the key-name contract test, not by a render.
- **The judgement half.** Whether the agent now reaches for the mask route and prompts only
  the delta is Fabio's call, in his own app, on the same ask: the boy's reflection alone
  turns demonic, under a normal boy.

## Noticed, not touched

`js/components/Primitives/MpiLevelMeter/MpiLevelMeter.js:2` imports `/js/utils/dom.js`
(server-absolute). Correct in the browser, unresolvable under Node, and it makes any module
graph that reaches it un-requireable from the CJS tests. Pre-existing, out of this card's
scope, worth a card of its own.
