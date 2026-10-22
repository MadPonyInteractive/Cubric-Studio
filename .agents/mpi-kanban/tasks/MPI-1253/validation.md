# MPI-1253 validation

Shipped in `8300de9b3`. Idea from a ComfyUI MOSS workflow video (Ok Todd AI, 15:00 on): an
"Analyze Image" button where a vision LLM writes a scene caption plus captioned boxes.

## Bench (question shape)

`ANALYSE_QUESTION` on Ollama `huihui_ai/qwen3-vl-abliterated:4b` (the app describer's family),
soap-ad picture cropped from the video: 5 items, boxes drawn back on the picture land tight on
the soap bar, headline and tagline; lettering quoted word for word. Confirms bbox_2d = [x1,y1,x2,y2]
on 0-1000.

## Unit

- `tests/layout-boxes-analyse.test.cjs`: 3 pass (fenced answer, clamp/drop/cap, no JSON -> null).
- `npm test`: 3524 pass, 0 fail. `npm run lint`: clean.

## Live (own `app:isolated` instance, describer = endpoint/Ollama qwen3-vl 4B)

- FLUX.3 edit: Analyse on picture 1 -> 6 named boxes in place, caption written into the empty
  prompt. Queue row, status bar, Prism "describing", Stop all shown while it ran.
- FLUX.3 t2i: gallery card dropped on the open panel -> guide drawn, NOT staged (imageCount 0,
  op stays t2i). Analyse -> ratio 1:1 -> 3:4 (picture 314x410), 4 boxes, caption.
- MOSS-Image t2i: ratio reset to 1:1, Analyse -> 3:4, 5 boxes, caption.
- Stop mid-run: job cancelled, Analyse button came back.
- Describer down: "Describe failed." toast, button came back.

## Not this card

Prism reads "cancelled" after every successful describe, the stock gallery Describe included
(control run, same session). Pre-existing.
