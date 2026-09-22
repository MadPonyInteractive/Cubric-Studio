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

---

# Round 3 — the edit RENDERED, and landed in the wrong place, 2026-09-22

Fabio re-ran the same ask in his own app. Round 2's fix held: the mask reached its own
picture and the graph executed. Two things came back.

## What actually ran — measured, not inferred

From the card's sidecar (`Media/.meta/70a18b20-….json`) and ComfyUI's own `/history`:

| | value |
|---|---|
| operation | `kleinEdit` |
| model | `klein-9b` |
| `inputImage` | `Media/t2i_003.png` — the card the mask was painted on |
| staged mask | `mpi_staged_d601d8393461b4af.png`, **768x1024** |
| staged image | `bff0c62f7b795cb2.png`, **768x1024** |
| graph | `InpaintCropImproved` ran with `mask: ['296', 1]`, no assertion |
| result | `Prompt executed in 37.21 seconds`, card `edit_003`, 768x1024 |

So the mask/image mismatch is FIXED LIVE, and Fabio's suspicion that "another operation was
used instead of edit" is settled: it was `kleinEdit`, masked, on his own card.

## Fault 1 — the edit was a NEW CARD, not the card's next version

Fabio: *"I didn't get any latents in the history workspace, and the image landed in the
gallery instead."*

Both halves are one cause. A Cue press in the History workspace dispatches
`{ existingGroup: _group, scope: 'groupHistory', groupId: _group.id }`
(`MpiGroupHistoryBlock._generationFromPromptPayload`). Dispatch had no card to name, so
every agent submit was `{ scope: 'gallery', tempId, placeholderGroup }` — and
`MpiGroupHistoryBlock` draws live frames only for `scope === 'groupHistory'` with its own
group id, so the workspace he was watching, mask still on screen, showed nothing at all
while the run went by. The result then appeared beside the original as `edit_003`.

**Root cause.** `activeMask` published the mask and its picture, but not the CARD that
picture belongs to — the same shape as round 2's bug one level up. A mask is painted on an
open card, so a masked edit is that card's next version.

**Fix.** The reader publishes `groupId`; `resolveMask` carries it as `maskGroupId`;
`maskedGenerationOpts()` resolves it against `state.currentProject.itemGroups` and hands
dispatch the history opts. Only a MASKED submit is rerouted — a maskless one names no card
and belongs in the gallery, where every agent generation has always landed. A card that is
gone (deleted, or another project opened between paint and submit) falls back to the
gallery rather than routing at nothing, which `generationService` would cancel.

**Proven red, one seam at a time** (`tests/agent-mask-dispatch.test.cjs`, 20 tests):

- `groupId` dropped from the workspace reader → 18 pass / 1 fail.
- `maskGroupId` dropped from `resolveMask` → 17 pass / 2 fail.
- the enqueue call put back to the gallery placeholder alone → 18 pass / 1 fail.
- all three restored → 20 pass.

## Fault 2 — the demon has nothing to do with the boy. NOT a bug, and not ours to fix here

Fabio: *"a demon face that has got nothing to do with the boy"*. The agent's own reply said
the same: a separate creature emerging from the water rather than the boy's reflection
turned demonic.

Traced through the dispatched graph. On a masked edit the model never sees the rest of the
picture:

```
296 Input_Mask ──boolean──> 592 MpiIfElse ──true──> 581 InpaintCropImproved output 1
474 Input_Image ─────────── 592 MpiIfElse ──false─> (the whole picture, maskless path)
592 -> 167 ImageScaleToTotalPixels -> 163 VAEEncode -> the sampler
```

With a mask, 592 forwards the CROP. `context_from_mask_extend_factor: 1.0` means the crop
is the mask bounding box and nothing more — measured here, **257x257 at (264, 683)** — then
`output_resize_to_target_size` blows it up to 1024x1024.

Extracted from the card, that crop holds the boy's **whole reflection**: head, hair, white
shirt, rod, upside down. What it does not hold is the rest of the frame — the boy himself on
the bank, and any cue that the figure in the water is a mirror image. Klein rendered an
UPRIGHT demon rising out of the water with its own reflection beneath it. The crop lost the
relationship, not the subject.

> Written first as "pure water, it had never seen the boy". That was read off the mask's mean
> brightness with no look at the pixels, and Fabio rejected it on the spot. Corrected here and
> on MPI-885.

This is the shipped graph's behaviour on EVERY masked edit, the Cue path included — nothing
agent-specific, and no part of this card. Carded separately; the two candidate directions
are a `context_from_mask_extend_factor` above 1.0, or passing the full picture into a free
reference slot on the models that have one.

## Suite

`npm test`: **1757 tests, 1755 pass, 0 fail**, 1 skipped, 1 todo (the pre-existing MPI-867
entry in `agent-video-attachment.test.cjs`). `npm run lint` and `npm run lint:components`
clean.

## Still not verified here

The reroute is proven by spec, not by a render — the same gap round 2 had, one level down.
Round 3's live check is one masked ask in the app: the latents draw in the History
workspace under the open card, and the result becomes its next version instead of a new
card in the gallery.

## Round 3, part 2 - the prompt, and its shape per op

Fabio, once the crop mechanism was on the table: *"The model only sees the masked area, so
why prompt other stuff in it? It's never going to work, is it?"* Right, and it closes
MPI-885 against itself - the crop is what masking IS, and widening it would have bought
context a correctly written prompt never needs.

The prompt sent was his own outside-the-picture framing, echoed: "turn the boy in the water
reflection into a demon version of himself ... faint red aura reflected in the water". The
model had an upside-down boy and no river; told about water and a reflection, it drew them.

Both the Masking rule and `docs/agent/masking.md` already said "prompt the delta only", and
the doc carried this exact example. It still did not bind, because the doc is FETCHED and the
prompt is composed later. So the worked pair moved into the system prompt, which is always
present, with the translate-never-echo rule and the ban on naming the region or what it sits
in.

Then his second correction, which the rule did not cover at all: **the shape is per-op.**

| op | what it wants | example |
|---|---|---|
| `edit` / `kleinEdit` / `krea2Edit` / `qwenEdit` | an INSTRUCTION - a verb on what is there | convert the boy into a demon |
| `detail` | a DESCRIPTION of what is already there, as a noun phrase | beautiful redhead woman, green eyes, freckles |
| `inpaint` | add, or remove | remove the flower from the vase / a flower |

`detail`'s denoise is half of what it means: under ~0.5 that description sharpens her, above
it you get a new redhead woman, same words. And both `detail` and `inpaint` are trial and
error on knobs the agent cannot see, so the rule now makes it say what it is about to send
before it sends it.

`tests/agent-loop.test.cjs` pins both rules; the `detail` shape backed out on its own is
81 pass / 1 fail. `npm test` 1759 tests, 1757 pass, 0 fail, 1 todo (the pre-existing MPI-867
entry). Lint clean.

**Open, Fabio's call:** whether the agent should RUN `detail` and `inpaint` at all, or teach
the user to run them. His words: "because detailing and inpainting are very trial-and-error
based, it could be a good idea to just make the agent tell the user how to use them instead
of trying to use them directly."
