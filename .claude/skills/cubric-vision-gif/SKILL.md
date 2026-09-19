---
name: cubric-vision-gif
description: Make and edit animated GIFs in a running Cubric Studio (formerly Cubric Vision) app from an agent - build a GIF from still cards or from a clip of a video card, retime it, trim it, set its loop count and palette, crop or resize it, cut the subject out of every frame onto transparency with BiRefNet or SAM3 by name, and turn a GIF back into a video. Use when asked to make a GIF, animate a set of images, loop a clip, remove a GIF's background, make a sticker, or convert a GIF to a video with Cubric Studio. Part of the cubric-vision skill family - image and video generations are cubric-vision-generate, Flows and text-to-speech are cubric-vision-flows, opening the target project first is the cubric-vision core skill.
user-invocable: true
metadata: {"openclaw":{"emoji":"👁️","os":["win32","darwin","linux"],"requires":{"anyBins":["curl"]},"primaryEnv":"CUBRIC_URL"}}
---

# Cubric Studio: GIFs

## Before anything else

Part of the Cubric Studio skill family; the entry point is the `cubric-vision` skill
([../cubric-vision/SKILL.md](../cubric-vision/SKILL.md)). Base URL `$CUBRIC_URL`,
default `http://127.0.0.1:3000`. Every route here is `POST` with a JSON body. Check
the app is up first with `curl -s -m 3 "$CUBRIC_URL/comfy/status"`: a refused
connection means Cubric Studio is not running.

**Everything here runs in whatever project the app has OPEN.** Open the right one
first with `POST /connector/open-project` (core skill) — there is no `folderPath` on
any of these routes, exactly as there is none on `/connector/generate`.

**Cards are named by ITEM id, not group id.** A card's group holds a history of
items; these verbs act on the item. `GET /connector/projects` and the
`cubric-vision-project-files` skill both read them, and every reply below carries
`output.itemId` so a chain of calls can feed itself.

## The envelope

`{ "ok": true, "output": { … } }` or `{ "ok": false, "error": { "code", "message" } }`.
A malformed body is HTTP 400; everything else is 200 with `ok: false`. Codes:

| Code | Means |
|---|---|
| `BAD_REQUEST` | The body's shape is wrong. The message says which field. |
| `APP_UNAVAILABLE` | No Cubric Studio window is listening. Is the app open? |
| `NO_PROJECT` | No project is open. `POST /connector/open-project` first. |
| `UNKNOWN_ITEM` | No item with that id in the open project. |
| `NOT_A_GIF` | That card is not a GIF. `make` one first. |
| `WRONG_TYPE` | A video was asked for and an image was given, or vice versa. |
| `ENGINE_ERROR` | The cut-out graph failed or returned the wrong number of masks. |
| `TIMEOUT` | No result in 30 minutes. The work may still be running in the app. |

## Make a GIF

Two sources, exactly one per call.

**From still cards** — two or more image cards, in the order you send them. The
first card's size wins; the rest are fitted inside it with transparent padding.

```bash
curl -s -X POST "$CUBRIC_URL/connector/gif/make" \
  -H 'Content-Type: application/json' \
  -d '{"itemIds":["<item-1>","<item-2>","<item-3>"]}'
```

**From a video card** — a clip of it, at a chosen frame rate.

```bash
curl -s -X POST "$CUBRIC_URL/connector/gif/make" \
  -H 'Content-Type: application/json' \
  -d '{"videoItemId":"<video-item>","fps":12,"sizePreset":"480xauto","trimIn":2,"trimOut":5}'
```

| Key | Notes |
|---|---|
| `fps` | Required with `videoItemId`. 1-60. |
| `sizePreset` | `original` (default), `480xauto`, `320xauto`, `autox480`, `autox320`. The number is the NAMED axis, not the longest edge. |
| `loop` | TOTAL plays. `0` (default) = forever, `1` = once, `N` = N plays. |
| `trimIn` / `trimOut` | Clip-seconds, and they come as a PAIR — one alone is a `BAD_REQUEST`. |

Both land a **new gallery card**. Frames are stored at the source's full
resolution; only the built `.gif` is sized, and it is never upscaled.

## Edit a GIF

One call, one new **entry on the same card** — the card's history grows, the gallery
does not. Send `itemId` plus at least one knob.

```bash
curl -s -X POST "$CUBRIC_URL/connector/gif/edit" \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"<gif-item>","trim":{"in":4,"out":28},"fps":10,"loop":0}'
```

| Key | Notes |
|---|---|
| `trim` | `{ in, out }` — frame INDICES, inclusive, not seconds. |
| `fps` | Retimes every frame. 0.1-50. A GIF cannot play faster than 50 fps, whatever you ask for. |
| `loop` | Total plays; `0` = forever. |
| `output` | `{ colours?, edgeColour?, maxEdge? }`. `colours` 2-256. **`edgeColour` carries the transparency toggle itself**: `"#rrggbb"` builds a transparent GIF and blends soft edges toward that colour, `null` builds an opaque one. |
| `resize` | `{ width, height }`. |
| `crop` | `{ x, y, width, height, fill?, outWidth?, outHeight? }` in source pixels. `fill` is a `"#rrggbb"` for any area the box takes from outside the frame; `outWidth`/`outHeight` set the OUTPUT resolution. |

**`crop` and `resize` cannot share a call.** Each rewrites every frame file, so a
call doing both would leave an intermediate entry nothing references. Send the
second as its own call, against the `itemId` the first one returned.

The timing knobs are free — they rewrite the frame LIST, not a single frame file.
A trim of a 200-frame GIF costs nothing on disk.

## Cut the subject out

Masks every frame and lands a new, **always transparent** entry on the same card.
This one runs on the GPU and can take a minute or more on a long GIF.

```bash
# Remove the background - BiRefNet, no prompt.
curl -s -X POST "$CUBRIC_URL/connector/gif/cutout" \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"<gif-item>","method":"background"}'

# By name - SAM3's video tracker follows what you name across every frame.
curl -s -X POST "$CUBRIC_URL/connector/gif/cutout" \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"<gif-item>","method":"name","prompt":"robot","adjust":{"grow":2,"fillHoles":true}}'
```

| Key | Notes |
|---|---|
| `method` | `background` (BiRefNet, whole subject, no prompt) or `name` (SAM3, needs `prompt`). |
| `prompt` | What to track: `"robot"`, `"the woman in red"`. Required for `name`. |
| `adjust` | `{ grow?, outward?, inward?, edge?, fillHoles? }` — the same Mask Adjust the workspace panel offers. `grow` is in output pixels. |
| `invert` | Swaps which side survives. |

**`name` keeps every object it tracks.** The workspace lets a person watch a
numbered preview video and untick objects; an agent cannot read that video, so
there is no way to choose, and all four tracked slots are kept.

**Nothing here paints.** The Mask Brush, the By colour method and per-frame scope
are the workspace's; a hand fix means opening the card in the app. If a cut-out
comes back wrong, change the prompt or the `adjust` and run it again — the source
entry is still on the card, untouched.

## GIF to video

A **new video card** beside the GIF; the GIF is left alone.

```bash
curl -s -X POST "$CUBRIC_URL/connector/gif/to-video" \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"<gif-item>","background":"#101014"}'
```

`background` fills whatever a transparent GIF leaves clear — h264 carries no alpha,
so without one a cut-out plays on black.

## What the reply carries

```json
{ "ok": true, "output": { "itemId": "…", "groupId": "…", "type": "image",
  "filePath": "…", "pixelDimensions": { "w": 480, "h": 270 },
  "frames": 24, "loop": 0 } }
```

`itemId` is what the next call in a chain takes. `filePath` is the built `.gif` (or
`.mp4`); fetch it through `GET /project-file?path=…` like any other media.

## Two things worth knowing before you plan a job

- **You cannot see the animation.** `POST /connector/describe` reads ONE still. If
  the user's judgement is about motion, flicker or pacing, say so and ask them to
  look — do not report a cut-out or a retime as "looking good".
- **A GIF is an image card.** It carries `gif: { frames, loop, output }` on its
  sidecar; everything else about it reads like any other image card, so the
  `cubric-vision-project-files` skill recovers its prompt and settings the usual way.
