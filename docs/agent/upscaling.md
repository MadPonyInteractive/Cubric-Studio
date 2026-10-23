# Detail and upscaling
Covers: more detail, sharper or bigger: every upscale and detail route, and which to take.

Every way the app adds detail or makes a picture bigger, what each does to the picture, and
which one to take. Pick by the user's words and the picture's size: the App state line, an
attached image and a `list_cards` row each give it as `WxH`.

## What each route does

| Route | How you run it | Bigger? | New detail? |
|---|---|---|---|
| Plain upscale | `imageUpscale`, a tool (no modelId): `fields.factor` 1.5 to 4 | yes | **no**: an upscale model sharpens what is there |
| Tiled upscale | a model's `upscale` op, `tiles: true`, `upscaleFactor` the factor | yes | yes: redrawn tile by tile (1024 px unless `tileSize` says), at any size |
| Tiled detail | the same with `upscaleFactor: 1` | no, same size | yes |
| One-pass upscale | a model's `upscale` op with tiles off | yes | yes, but the whole picture in ONE pass at the new size: a big result can break into patterns |
| Image to image | a model's `i2i` op at a low denoise | no: it comes back at the op's ratio size, about 1 MP | yes, the whole picture redrawn |
| Detail | a model's `detail` op on a mask the user paints | no, the source's size | only inside the mask |
| Edit | an edit op | no: it redraws at about 1 MP | **never**: it changes what is IN the picture |

An enlargement with no model at all is in the app's own panels. Name it when asked; the user
picks it there.

## Which one to take

1. **"Upscale", with no word about detail**: offer `[options: Plain upscale | Tiled upscale]`.
   Plain is quick and changes nothing; tiled adds detail and takes longer. Several cards at
   once: plain, unless they asked for detail.
2. **Bigger AND more detail** ("upscale it, make it full of detail", "bigger and sharper"):
   tiled upscale at their factor, 2 when they name none. No question.
3. **More detail on the whole picture, same size**:
   - about 1 MP (around 1024 px on the long side): offer
     `[options: Image to image | Tiled detail]`.
   - 2K or more on the long side: tiled detail, no question.
4. **Detail on ONE thing** ("her face", "the chair on the right", "the water", "the
   mountain"): ask them to paint a mask over it, then run the detail op. Never tile the whole
   picture for one thing.
5. **A redraw that came back wrong** (patterns, mush, "it looks bad"): the next try is tiled.
   Never the plain upscale: it adds nothing, so it cannot fix missing detail.
6. **A very large result** (4K and more): tiled, or plain when they only want it bigger. Never
   a one-pass upscale.

## Running tiles

- Every image model's `upscale` op has tiles: `describe_model` lists `params.tiles` and
  `params.upscaleFactors`, and `params.tileSizes` for `tileSize` (smaller = more tiles, more
  detail, slower). A size the user names wins. Otherwise send `tileSize` from the RESULT's
  long side (the card's `size` times the factor): up to 2,000 px = 512, up to 3,000 = 768,
  up to 4,000 = 1024, above = 1536. Small tiles on a big picture run thousands of tiles (a
  16K result at 256 is about 4,000); this keeps every run near 20, at most about 130 at 16K.
- Every tile gets the WHOLE prompt, plus a short name of what fills it: the app names each tile
  itself before the run ("Naming N tiles" in the queue). People and faces get their own passes
  with no names. Describe the look ("sharp photo, fine skin texture, film grain") or send none.
  Never describe the scene: each tile would paint it again.
- A big picture is many tiles: say in one line that it takes a while.
- How many tiles: the generate result says UP TO a number (tiles a person fills are left to the
  people pass); the status bar counts them. Never work it out from the size yourself (overlap
  makes it far more than size / tile size).
- Leave denoise at the op's default unless the user wants more change.
