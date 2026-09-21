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

---

# Round 2 — what Fabio's live check found, 2026-09-21

Round 1's claim held: the agent asks for the mask instead of running maskless. Three
faults came back with it. All three are fixed, and the first one is why nothing rendered.

## 1. A mask reached a picture it was never painted on

Five dispatches, two models, zero cards:

```
[13:45:15] kleinEdit / klein-9b  — InpaintCropImproved failed: AssertionError: Mask
[13:45:18] kleinEdit / klein-9b    dimensions do not match image dimensions.
[13:45:27] kleinEdit / klein-9b    Expected torch.Size([682, 512]), got
[13:48:31] krea2Edit / krea2       torch.Size([1024, 768])
[13:48:35] krea2Edit / krea2
```

`inpaint_cropandstitch.py:1352` — `assert mask.shape[1:] == image.shape[1:3]`, so
"expected" is the IMAGE: 512x682, against a 768x1024 mask.

Measured, not inferred:

| | size | what it is |
|---|---|---|
| mask | 768x1024 | the open card, `t2i_003`, at its real size |
| image | 512x682 | `AppData/Roaming/Cubric Studio/agent/attachments/att_564c16a9.webp` |

`sharp(...).metadata()` on that attachment returns `512x682 webp`. `routes/projects.js:91`
documents `<id>.thumb.webp` as "the 512 rendition". Exactly 2/3 of the card in both axes.

**Root cause.** The mask came from `activeMask` (the workspace) and the image from whatever
the model named (a chat attachment). Nothing connected them. A mask is a region OF a
picture; publishing the pixels alone let it land on a different one. A *correct* attachment
would have broken the same way the moment the user painted on another card.

**Fix.** `setMaskReader` publishes `{ dataUrl, url }` — the mask and the picture under it.
`bindMaskedSource(mediaItems, maskUrl)` points `inputImage` at that picture. Only that slot:
kleinEdit takes three images and injection is ordinal, so rewriting a reference would change
which picture is the edit.

**Proven red, one fault at a time** (`tests/agent-mask-dispatch.test.cjs`, 14 tests):

- binding backed out -> 12 pass / 2 fail, and the diff is the live bug verbatim:
  `actual '/...att_564c16a9.webp'` vs `expected '/...t2i_003.png'`.
- `maskUrl` dropped from `resolveMask` -> 12 pass / 2 fail.
- restored -> 14 pass.

## 2. The reply was the reasoning

Four paragraphs before the answer, naming its sources: "According to the masking rule, I
need to ask the user to paint a mask", "The kleinEdit note says it tends to cover a bare
subject". The strip beside the chat had already shown `READING: APP:MASKING` and `READING
KLEIN-9B'S SETTINGS` as they happened.

The seam is the pronoun — the deliberation says "the user", the answer says "you", and both
went into `message.content`, so no `thinking` field could have split them (`think: false` is
advisory and `llmEngines.mjs:258` takes `data.message.content` whole).

The prompt carried six rules about what to DO and none about how to speak, and two of them
("say in one short line which model you used and why") read as a licence to justify
everything. A **Voice rule** now names the three shapes it took and keeps those two one-line
"why"s intact. `tests/agent-loop.test.cjs` pins it.

## 3. "History" is our name for it

Fabio: "most users will never know what history means." `PAGE_GROUP_HISTORY` is internal;
the UI writes it nowhere. Corrected in the Masking rule, the `MASK_UNSUPPORTED` refusal,
`docs/agent/masking.md` and the Honest-limits line, and the refusal test now asserts the
word never comes back.

## Suite

`npm test`: **1748 tests, 1746 pass, 0 fail.** The 1 todo is the pre-existing MPI-867 entry
in `agent-video-attachment.test.cjs` (it prints an AssertionError and is counted as `todo`,
not `fail`), untouched by this card. `npm run lint` and `npm run lint:components` clean.

## Still not verified here

**No real generation has rendered.** The size mismatch is fixed by construction and pinned
by a spec, but round 1 proved that a trace is not a render. Round 2 is Fabio re-running the
same ask in his own app: the boy's reflection alone turns demonic, under a normal boy.
