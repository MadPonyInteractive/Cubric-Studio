---
name: cubric-vision-generate
description: Dispatch image and video generations in a running Cubric Vision app from an agent, landing as real gallery cards with history and sidecar, through POST /connector/generate. Covers model ops by ModelDef id (the modelId trap), named params (ratio, quality tier, turbo, style, seed), naming the card as it lands, reference images fed with your own files for edits, image-to-video and reference-to-video ops (Klein Edit with up to three references), raw injectionParams, and every error code. Use when asked to generate, edit, upscale or animate an image with Cubric Vision, or to run several variations. Part of the cubric-vision skill family - Flows and text-to-speech are cubric-vision-flows, opening the target project first is the cubric-vision core skill.
user-invocable: true
metadata: {"openclaw":{"emoji":"👁️","os":["win32","darwin","linux"],"requires":{"anyBins":["curl"]},"primaryEnv":"CUBRIC_URL"}}
---

# Cubric Vision: dispatching a generation

## Before anything else

Part of the Cubric Vision skill family; the entry point is the `cubric-vision` skill
([../cubric-vision/SKILL.md](../cubric-vision/SKILL.md)). Base URL `$CUBRIC_URL`,
default `http://127.0.0.1:3000`. Nearly every route is `POST` with a JSON body. Check
the app is up first with `curl -s -m 3 "$CUBRIC_URL/comfy/status"`: a refused
connection means Vision is not running. Hand every prompt back to a user whole and
pasteable, never as a fragment to splice.

## Dispatching a generation

`POST /connector/generate` submits a prompt and lands a **real gallery card** —
history entry and `.meta` sidecar included — because it goes through the same
queue the PromptBox uses (MPI-546).

```bash
curl -s -X POST "$CUBRIC_URL/connector/generate" \
  -H 'Content-Type: application/json' \
  -d '{"modelId":"krea2","operation":"t2i","positive":"a lone rider at dusk"}'
```

Body: `modelId` and `operation` are required; `positive`, `negative`,
`injectionParams`, `media` (reference images, see below) and `cardName` (see Naming
the card) are optional. **The request resolves when the generation
finishes**, not when it is queued, so expect it to block for as long as the run
takes (a queued video can be minutes; the route gives up after 30 and the
generation carries on in the app regardless).

### Named params (v1)

Six of the PromptBox's controls are reachable by name, without hand-writing a
node title (MPI-547). **Per-generation only — none of these persist.** A submit
with `turbo:true` runs turbo once and leaves the project's saved settings
untouched; the next manual Cue press in the app sees exactly what it did before.
An unset one falls back to whatever the open project currently has set (the
same value a manual Cue press would use), never to the workflow's own baked
default — so a size/quality/style you never asked for cannot silently apply,
and one you never *un*-asked for cannot silently vanish either.

```bash
curl -s -X POST "$CUBRIC_URL/connector/generate" \
  -H 'Content-Type: application/json' \
  -d '{"modelId":"krea2","operation":"t2i","positive":"a lone rider at dusk",
       "ratio":"9:16","qualityTier":"2k","turbo":true,"seed":12345}'
```

| Param | Type | Notes |
|---|---|---|
| `ratio` | string | A ratio label the model offers, e.g. `"9:16"` — not orientation-specific, it is matched against both. |
| `qualityTier` | string | One of the model's own tiers (`krea2`: `1k`/`2k`; `wan`/`ltx`/`h3`: `very_low`…`4k`). Models with no quality axis (`flux`/`sdxl`/`klein`/`chroma`) reject any value here. |
| `turbo` | boolean | Maps to whichever turbo toggle the model has (`krea2Turbo` or `h3Turbo`) — send the same friendly `turbo` key either way. Rejected on a model with neither. |
| `styleSelect` | integer | Index into the model's style rack (`styleLoraLabels`), 0 = no style. Rejected on a model/operation with no style rack. |
| `stylization` | number | 0..1, the selected style's strength. Same style-rack gate as `styleSelect`. |
| `seed` | integer | 0..4294967295. Unset stays random — this is the only way to pin one; the PromptBox itself has no seed UI. |

An invalid value is a **named error, never a silent fallback** — an unknown
ratio label, a tier the model does not declare, a non-boolean `turbo`, an
out-of-range `styleSelect`, all fail the request rather than running
with something you did not ask for (see the error table below).

**No `batch`. Want three images? Send three submits.** An agent submit always
runs at batch 1, whatever the open project's batch control says, and a body
carrying `batch` is refused with `BATCH_UNSUPPORTED`. A batch of N holds N
images in VRAM at once; N submits queue and each holds one. Each request blocks
until its own run finishes, so fire them together and collect N results.

`ratio`/`qualityTier`/`turbo`/`styleSelect`/`stylization` all merge into
`injectionParams` under the hood — a raw `injectionParams` key still wins over
a named one, so `{"ratio":"9:16","injectionParams":{"Width":999,"Height":999}}`
generates at 999×999. The single resolver behind both the named params and the
manual PromptBox is `js/data/generationControls.js`.

**`modelId` is the ModelDef id, and it is not the name.** They come from
`js/data/modelConstants/models.js` (grep `id: '`) - `klein-4b`, not `klein`;
`minimax-h3-ref2va`, not `minimax-h3`. A wrong one returns `UNKNOWN_MODEL`,
which reads like the model is not installed when it is only misspelled.

**`injectionParams` keys are logical names, not node titles.** `Width`,
`Height` and `Ratio_Label` for size. A control that shares one node with
another addresses its own widget through a dotted key - the style rack is
`Input_Style_Selector.selector` (an integer index into the model's
`styleLoraLabels`) and `Input_Style_Selector.strength_model` (the stylization
float). The authority is each control's `getInjectionParams()` in
`js/components/Organisms/MpiPromptBox/PromptBoxControls.js`.

Raw `injectionParams` always wins over anything the app resolves, which makes
it the escape hatch for a parameter with no named form yet. **It now reaches the
sidecar's `controlState`** (MPI-556): the snapshot reconciles every control
against what the run actually injected, so a generation steered this way is
reused with the settings it ran with, not the project's. A control that maps its
value rather than passing it through — `controlType`'s id → index — cannot be
recovered from the injected value and is left out of the sidecar rather than
recorded wrong, so Reuse leaves that one control where it currently sits.

Success returns the item, so a follow-up run can consume it:

```json
{ "ok": true, "output": { "itemId": "...", "groupId": "...", "type": "image",
  "filePath": "C:/.../out.png", "seed": 12345, "pixelDimensions": {"w":1024,"h":1024},
  "generationMs": 8410 } }
```

### Naming the card

Name a card whenever you and the user will talk about it: "Rider at dusk" survives a
conversation, `t2i_017` and `t2i_018` get swapped. `cardName` names the card the moment
the run lands, on a model op and on a Flow alike, and the reply carries
`output.cardName`:

```bash
curl -s -X POST "$CUBRIC_URL/connector/generate" \
  -H 'Content-Type: application/json' \
  -d '{"modelId":"krea2","operation":"t2i","positive":"a lone rider at dusk","cardName":"Rider at dusk"}'
```

A card that already exists is renamed with `POST /connector/rename-card` - see
[../cubric-vision/projects.md](../cubric-vision/projects.md) § Naming cards. The name is
a label only: the file on disk keeps its generated name.

Failure returns `{"ok": false, "error": {"code": ..., "message": ...}}`:

| Code | Meaning |
| --- | --- |
| `APP_UNAVAILABLE` | No Vision window is listening. The app must be OPEN. |
| `NO_PROJECT` | No project is open. The run uses whatever project the app has open — it never switches for you. |
| `UNKNOWN_MODEL` | No model with that id. |
| `OP_UNAVAILABLE` | The model does not support that operation, or its weights are not installed. |
| `MEDIA_REQUIRED` | A required media slot is empty. Names the slot. |
| `MASK_UNSUPPORTED` | The operation needs a painted mask (`inpaint`, `detail`), which has no agent form. |
| `BAD_REQUEST` | A media role the operation does not have (the message lists its roles), a media entry with no `url`, or one role given twice. |
| `CANCELLED` | Cancelled, or produced no output. |
| `TIMEOUT` | No result in 30 minutes. The generation may still be running. |
| `INVALID_RATIO` | `ratio` is not a label this model/operation offers. |
| `INVALID_QUALITY_TIER` | `qualityTier` is not one this model declares (or it has no tier axis at all). |
| `INVALID_TURBO` | `turbo` is not a boolean, or the model has no turbo toggle. |
| `INVALID_STYLE_SELECT` | `styleSelect` is out of range, or the model/operation has no style rack. |
| `INVALID_STYLIZATION` | `stylization` is not 0..1, or the model/operation has no style rack. |
| `BATCH_UNSUPPORTED` | The body carried `batch`. Agent submits always run batch 1: send N submits instead. |
| `INVALID_SEED` | `seed` is not an integer in 0..4294967295. |
| `INVALID_CARD_NAME` | `cardName` is not a string. |

Check `generationSubmit` in `GET /connector/capabilities` to confirm a window is
listening before submitting.

### Supplying images and video (reference inputs)

An op that takes media (Klein's `kleinEdit`, `i2i`, `upscale`, `i2v`, the
reference-to-video ops) takes it as `media: [{ role, url }]`, the same shape a
Flow takes (MPI-765). **By reference, never bytes:** stage each file first with
`place-preview-asset` (the `cubric-vision-flows` skill,
[§ Supplying your own audio, image or video](../cubric-vision-flows/SKILL.md); it takes
a plain absolute path) and pass back the `filePath` it returns.

```bash
curl -s -X POST "$CUBRIC_URL/connector/generate" \
  -H 'Content-Type: application/json' \
  -d '{"modelId":"klein-9b","operation":"kleinEdit",
       "positive":"Put the fox from Image 2 sitting beside her on the bench.",
       "media":[{"role":"inputImage","url":"<filePath of the image to edit>"},
                {"role":"inputImage2","url":"<filePath of the reference>"}]}'
```

**`role` is the op's slot key**, from `mediaInputs` on the op in
`js/data/commandRegistry.js` (grep `kleinEdit: {`); an op declaring
`requiresImages: N` instead has `inputImage`, `inputImage2`, and so on. A wrong
role is refused and the message lists the real ones, so one bad submit tells you
the vocabulary.

- **Order is the slot's, not yours.** Klein Edit's `inputImage` is the picture that
  gets edited; `inputImage2` and `inputImage3` are optional references ("Image 2",
  "Image 3" in the prompt). Entries are sorted into declared slot order whatever
  order you send them in.
- **Required slots are checked BY ROLE before anything queues.** `MEDIA_REQUIRED`
  names the empty one: a reference sent alone as `inputImage2` does not stand in for
  the `inputImage` being edited. Optional slots may be left off.
- **Klein Edit follows the SOURCE image size.** `ratio` is refused on it; size the
  image you stage.

### What it does not do yet

- **No mask.** `inpaint` and `detail` need a painted mask and are refused with
  `MASK_UNSUPPORTED`.
- **No job status or cancellation.** One submit, one result.

Project switching is no longer on this list — `POST /connector/open-project`
covers it (see [../cubric-vision/projects.md](../cubric-vision/projects.md) § Creating a
project, then generating into it).

### Still true: do not POST a graph to `/proxy/prompt`

It **runs on the engine and produces nothing in the UI** — no card, no history
entry, no `.meta` record. The picture exists and the project never learns about
it. Use `/connector/generate`.

## Agent tool routes (MPI-774)

`GET /connector/models` — `{ ok, engine, hardware: {gpuName,vramGb,ramGb}, models, flows }`. Each model has `installed`, `ops`, `missingDownloadGb`, and `fit: {floorVramGb, ramGbAtYourVram, runs}`. Requires a Vision window (`APP_UNAVAILABLE` otherwise).

`GET /connector/knowledge` — corpus index `{ ok, entries: [{id,kind,title,tags}] }`. `GET /connector/knowledge/:id` — one entry with `text`. Error: `UNKNOWN_ENTRY`.

`POST /connector/install { modelId }` — starts downloading missing deps. Returns `{ ok, modelId, downloadGb, started: true }`. Non-blocking; track via `GET /comfy/downloads/status`. Errors: `BAD_REQUEST`, `UNKNOWN_MODEL`, `ALREADY_INSTALLED`, `OFFLINE`, `APP_UNAVAILABLE`.

`POST /connector/describe { imagePath, question?, crop? }` — runs the image describer. `crop` = `{x,y,width,height}` in original pixels; the route crops with sharp first. `question` injects a ChatML string into `Input_Describe_Prompt`. Returns `{ ok, output: { text } }`. Errors: `BAD_REQUEST`, `IMAGE_NOT_FOUND`, `CROP_OUT_OF_BOUNDS`, `DESCRIBER_MISSING`, `APP_UNAVAILABLE`, `RUNTIME_ERROR`, `TIMEOUT`.
