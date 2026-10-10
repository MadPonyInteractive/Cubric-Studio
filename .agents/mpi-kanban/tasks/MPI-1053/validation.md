# MPI-1053 validation

## Phase 1 - inventory + size signal (2026-10-09)

Measured on master `cd6a6bff8` with a scratch script (`_buildSystemPrompt('auto')`, `TOOL_DEFS`,
`opPriority`). Totals: **SYSTEM 10,814 / TOOLS 19,006 bytes** (both exactly at budget).

| Where | Text (gist) | Bytes | Budgeted? | Seen |
|---|---|---|---|---|
| System, Model rule (whole line) | task-first routing; edit vs i2i vs re-run | 1,297 | SYSTEM | every request |
| ...its 019d0e507 clause | "More detail or sharpness on the whole picture is the upscale task, never an edit." | 82 | SYSTEM | every request |
| System, Route rule | one area -> mask / both routes; "a mask keeps the source's size ... offer one for a big photo" | 919 | SYSTEM | every request |
| System, Masking rule | how to paint; app:masking gate | 462 | SYSTEM | every request |
| `generate.denoise` arg | i2i/upscale/detail, 0-1 | 232 | TOOLS | every request |
| `generate.tiles` arg | 1024 px tiles; huge picture or 1x detail; tile prompt = the look | 229 | TOOLS | every request |
| `generate.upscaleFactor` arg | one of params.upscaleFactors; 1 needs tiles | 78 | TOOLS | every request |
| `OP_NOTES.upscale` (modelPriority.js) | re-renders to add detail; plain enlargement = imageUpscale | 234 | no (list_models) | **x12 models** per list_models |
| `TILES_NOTE` (019d0e507) | "at any size ... tiles: true and upscaleFactor 1 ... tell the user ... tile prompt" | ~400 | no | **x10** (every ranked upscale op; `-nsfw` get only NSFW_NOTE) |
| `OP_NOTES.detail` (019d0e507) | "only the area the user masked. More detail across the whole picture is the upscale op with tiles at 1x" | ~105 | no | x12 |
| `OP_NOTES.i2i` | restyle route; re-run rule; denoise low; miss -> edit | 539 | no | x12 |
| per-model `NOTES` krea2/chroma `:upscale`/`:detail` | skin detail vs character drift | ~200 | no | per model |
| `imageUpscale` tool note (agentToolOps.js) | plain x1.5-x4 "no model, no prompt"; upscaler + factor fields | 325 | no | **once** (tools list, rank 1 / best for upscale) |
| MCP `generate` denoise/tiles/upscaleFactor (routes/mcp.js:415-417) | same three, MCP wording | ~520 | no | MCP tool list |
| `app:operations` (gated, generated from commandRegistry) | Upscale / Detail / i2i / pid sections, Use Tiles paragraph | 12,316 total | no | only on read_knowledge |
| `docs/agent/masking.md` | "A mask keeps the pixels" (l.33), "small area: enlarge first ... ask the user to run Resize" (l.115), source size kept (l.150) | - | no | gated (masked op) |
| `docs/agent/models/*.md` | per-model upscale/detail denoise + prompt lines | - | no | per guide |

Per list_models call the upscale/detail op notes ride ~12 times; 019d0e507 alone added about
**5 KB** to every list_models answer (TILES_NOTE x10 + detail note x12).

Every upscale-capable model has `capabilities.tileUpscale: true` (sdxl-realistic, sdxl-nsfw,
ill-anime-beauty, ill-anime, pony-mix, chroma-flash, chroma-hyper, krea2, krea2-nsfw, klein-4b,
klein-9b, qwen-image-2-1), so "tiles at 1x" is available on any installed image model.
**Grid is not an agent param**: `resolveNamedParams` takes `Input_Auto_Grid` from the project's
saved panel (`opSaved.useGrid`), so an agent's `tiles: false` runs normal OR Grid depending on
the panel. The workspace's model-less basic upscale is not an agent tool (imageUpscale always
sends `Upscale_Using_Model: true`).

### Size signal - how the agent learns a picture's pixels

| Source | Carries WxH? |
|---|---|
| Attached image / dragged gallery card (`[Attached image N: ... (ref, WxH)]`) | yes (`_imageSize`, sharp, EXIF-upright) |
| `[Generation finished: card ..., WxH]` | yes (`pixelDimensions`) |
| `list_cards` row (agent + MCP) | yes, `size` from the sidecar's `pixelDimensions` |
| `look` with `box` | yes, `output.imageSize` |
| **App state: "The user is looking at the card ..., the entry open in front of them is <path>"** | **NO** - the commonest "detail THIS image" case; the agent must call list_cards or look to learn the size |

Gap to close in Phase 2: put the open entry's `WxH` on the App state line (code, `_imageSize`,
per-turn context only - not the system prompt budget).

## Phase 2 - rewrite, not append (2026-10-09)

- Every detail/upscale route now lives ONCE, in the `imageUpscale` tool note
  (`js/shell/agentToolOps.js`, 325 -> 868 B, shown once per list_models, and to MCP through
  the same connector route): plain upscale vs model upscale (normal / tiles, 1x keeps size),
  very large -> normal or tiles, ONE thing -> mask + detail op, whole picture ~1 MP ->
  `[options: Image to image | Tiled detail]`, 2K+ -> tiles at 1x with a "takes a while" line,
  edit never adds detail, Grid + no-model upscale named as the user's.
- Removed 019d0e507's `TILES_NOTE` and `OP_NOTES.detail`; `OP_NOTES.upscale` 234 -> ~130 B,
  points at the tool note. Per upscale op: krea2 816 -> 312 B, klein-9b 668 -> 164 B;
  krea2:detail 285 -> 181 B. Roughly **-5.5 KB per list_models** answer.
- Model rule clause: "More detail or sharpness is never an edit: imageUpscale's note routes it."
  (covers ONE thing too, which the old whole-picture clause did not).
- `generate.tiles` drops its "when" (now in the note); `upscaleFactor` says 1 keeps the size.
- App state line: the open entry now reads `<path>, WxH.` (`_imageSize` in the turn opening).
- Budgets lowered to measured: **SYSTEM 10,814 -> 10,805, TOOLS 19,006 -> 18,966.**
- Tests: `agent-tiles` routing test rewritten (note holds the routes, op notes repeat none,
  Model rule pointer); `agent-loop` App-state size (pure + a real turn on `logo.webp`, 128x86).
  `npm test`: **2,818 pass, 0 fail, 2 skipped** (exit 0).

## Phase 3 - live check, round 1 (2026-10-09, Fabio)

- FAIL. 800x1024 crop, "upscale it, make it really nice and full of detail": Cosmo ran
  qwen-image-2-1 `upscale` at 2x with `tiles=false (defaulted)` - one 1600x2048 pass
  (`Grid: 1x1, Tiles amount: 1` in app.log), skin broke into a cross-hatch pattern. Asked for
  "another upscale method", it took the plain `imageUpscale` (Siax): sharper, no detail. No option offered.
- Cause: the Phase 2 note listed "normal (bigger)" first as a detail route and lost 019d0e507's
  "Bigger and more detailed: tiles with a factor". Fixed in the note: bigger AND more detail ->
  tiles with the factor, no question; just "upscale" -> `[options: Plain upscale | Tiled upscale]`;
  a redraw that came back wrong -> tiles, never plain; tiles off = ONE pass, a big result can
  break into patterns. Note 868 -> 1,205 B (once per list_models). agent-tiles test pins all three.

## Phase 3 - live check, round 2 (2026-10-09, Fabio)

- FAIL. App restarted 19:24:40Z, after the round-1 note fix (19:23:39Z), so it ran on it. 818x1024,
  "a lot more detail and perhaps be bigger": Cosmo ran the PLAIN `imageUpscale` (first try refused,
  media role `image`), result `imageUpscale_002` 1636x2048, while telling the user it was "redrawn at 2x".
- Cause: the routes sat in the plain tool's own note, and that tool is `best: true` for the upscale
  task; the Model rule says best marks the op to take. A note cannot beat that flag.
- Fix (the brief's other sanctioned home): `docs/agent/upscaling.md` = `app:upscaling` (routes table +
  six decisions + running tiles); `generate` refuses `upscale` and `imageUpscale` with
  `KNOWLEDGE_NOT_READ` until it is read (same gate as app:masking, once per conversation, before a
  batch is offered). Tool note back to plain facts + "adds NO detail" + pointer; `OP_NOTES.upscale`
  points there; Model rule clause "Detail or size is never an edit: app:upscaling." Also fixed two
  missing spaces in the Model rule ("routes it.A head" - mine, the Edit tool trims a trailing space -
  and the older "never a mask.The same"). SYSTEM 10,808 (card start 10,814), TOOLS 18,966.
- Tests: gate test in agent-loop (plain refused, read, model upscale with tiles reaches the app);
  agent-tiles pins the doc decisions and every pointer. `npm test` 2,827 pass, 0 fail.

## Phase 3 - live check, round 3 (2026-10-10, Fabio) - PASS

- App restarted 22:21Z / 23:39Z, after the 19:32Z edits. "I need a lot more detail in this picture.
  I would like it to be bigger ... more pixels, more detail" on the 818x1024 crop: Cosmo read
  `app:upscaling` on its own BEFORE any generate, then the Krea 2 guide (the one "Generation not
  started" was the GUIDE_NOT_READ gate), then app.log 02:10:44Z:
  `krea2:upscale - ... tiles=true (asked), upscaleFactor=2 (asked)`. Fabio cancelled it (GPU busy).
- Fabio confirmed the decision table for a bare "add detail" as spot on (named thing -> mask; ~1 MP ->
  [Image to image | Tiled detail]; 2K+ -> tiled detail, no question) and declined adding a Mask button.
  This is his "1" for Phase 3.
