# Box measurement - what the two describers answer for "box the head"

*MPI-774 Phase 4, 2026-09-17, session 047d6088. Live: my own `app:isolated` instance attached to
the engine on 48188, GPU lease held for every ComfyUI call. Scripts: `boxes.mjs`, `spec-from.mjs`,
`draw.mjs` in that session's scratchpad (not kept).*

## Inputs

Three SDXL Realistic outputs the agent made in project "MPI-774 agent test" (turn 1, t2i):

| Image | Size | Remote input (route, <= 1 MP, floor 16) | ComfyUI input (node 41, 1 MiB, round 16) |
|---|---|---|---|
| `t2i_001.png` woman, full body, small head | 896x1152 | 880x1120 | 896x1168 |
| `t2i_002.png` older man, waist up | 832x1024 | 832x1024 | 928x1136 |
| `t2i_003.png` young man, head and shoulders | 1024x1024 | 992x992 | 1024x1024 |

Two phrasings per image:

- **json:** `Find the head of the person in this image. Reply with only JSON: {"bbox_2d": [x1, y1, x2, y2]}, the bounding box of the head.`
- **native** (Qwen's own grounding phrasing): `Locate the person's head in the image, and output its bbox coordinates in JSON format.`

## Raw answers

**Remote, `meta-llama/Llama-4-Scout-17B-16E-Instruct`** (1.2-3.5 s each, no GPU):

| Image | json | native |
|---|---|---|
| 001 | `{"bbox_2d": [0.431, 0.306, 0.571, 0.430]}` | `**head**: <BBOX>0.397,0.321,0.634,0.951</BBOX>.` (the whole body) |
| 002 | `{"bbox_2d": [0.387, 0.052, 0.777, 0.429]}` | `**head**: <BBOX>0.349,0.049,0.794,0.471</BBOX>.` |
| 003 | `{"bbox_2d": [0.349,0.070,0.694,0.533]}` | a fenced `{"bbox": {"x": 0.302, "y": 0.065, "w": 0.697, "h": 0.419}}` |

**ComfyUI, Qwen3-VL 4B (`image_descriptor.json`)** (5.8-10.5 s each), after the injection fix below:

| Image | json | native |
|---|---|---|
| 001 | `{"bbox_2d": [458, 310, 576, 419]}` | fenced `[{"bbox_2d": [453, 310, 598, 437], "label": "person's head"}]` |
| 002 | `{"bbox_2d": [435, 68, 799, 487]}` | fenced, same numbers |
| 003 | `{"bbox_2d": [357, 90, 698, 554]}` | fenced, same numbers |

## Verdict

- **Coordinate space: RELATIVE on both.** Llama-4-Scout answers on 0-1, Qwen3-VL on 0-1000. Drawn on
  the originals under every candidate space (0-1000, pixels of the describer's input, pixels of the
  original), only the relative reading lands on the head in all three; 001 and 002 separate the
  candidates clearly, 003 (square, no resize) cannot. So the describer's resize never enters the
  mapping: `x = regionX + x_rel * regionWidth`, region = the crop or the whole image.
- **Phrasing: the json one.** 6/6 answers were one clean `bbox_2d` array. The native phrasing drifted
  across three wrappers on Remote, and on 001 boxed the whole body. The route appends
  `Reply with only JSON: {"bbox_2d": [x1, y1, x2, y2]}, its bounding box.` to the caller's question.
- **Parse:** the first four numbers after dropping JSON key names (`bbox_2d` carries a digit);
  max <= 1 -> 0-1, max <= 1000 -> 0-1000, else no box (`NO_BOX`). Inverted or short -> no box.
- **Quality:** every json box holds the face. Remote's box on 002 stops at the beard (the chin is
  inside, the beard's bottom is not); ComfyUI's covers it. Both are tight enough for Head Swap once
  squared, which the agent does (the step has `ratio: 1`).

## Two defects the measurement found (both fixed in this session)

1. **A ComfyUI describe with a question never showed the model the image.**
   `buildDescribeInjectionParams` sent `<|im_start|>system\n{question}<|im_end|>\n<|im_start|>user`.
   Node 38 feeds `TextGenerate` directly, and the Qwen3-VL tokenizer uses a prompt that starts with
   `<|im_start|>` verbatim (`comfy/text_encoders/qwen3vl.py`, `skip_template`), placing the image only at
   an `<|image_pad|>` token. No pad, no assistant header: Qwen3-VL answered with an EMPTY string. Every
   agent `look` with a question on ComfyUI was affected (local and Pod). Now the whole turn is sent, in
   the baked default's shape: image pad, the question as user text, assistant header.
2. **An empty answer hung the caller.** `generationService`'s text-op branch warned and returned
   without a callback, so `describeImage`, the ComfyUI enhance, both agent-dispatch paths and a Flow's
   auto-Enhance waited forever (the agent's `look` until the relay's 30-minute budget; a Flow's
   Generate behind its auto-Enhance, indefinitely). It now calls `onError`. Observed live: the first
   ComfyUI box call produced no HTTP answer for 300 s, `app.log` said `imageDescribe returned no text`
   at +2 s.
