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

## Getting footage in, and finding its item id

**Every verb here works on a card that is ALREADY in the project.** There is no route
that pulls a file in from disk and lands a card: `POST /project-media/:id/upload` writes
the file and its sidecar but not the gallery card, because the renderer owns
`itemGroups`. So the footage arrives one of two ways:

- **The person drops it in.** A folder dragged onto the gallery imports every clip in it
  as cards. This is the on-ramp today for a batch of footage that lives in another repo.
- **It was generated in the project already**, by `/connector/generate` or by hand.

To find the item ids without the app telling you, read the project off disk — that is the
`cubric-vision-project-files` skill. `project.json`'s `itemGroups[]` carry
`history[]` (item ids, oldest first) and `selectedIndex` (the one the card is showing);
`Media/.meta/<id>.json` says each item's `type` and `filePath`. A video card is
`type: "video"`; the GIF you make from it comes back with its own id in `output.itemId`.

```bash
# every video card in a project, its item id first
python -c "import json,pathlib,sys; r=pathlib.Path(sys.argv[1]); p=json.loads((r/'project.json').read_text(encoding='utf-8')); [print(i, m.get('type'), g.get('customName') or g.get('name')) for g in p['itemGroups'] for i in [g['history'][g.get('selectedIndex',0)]] for m in [json.loads((r/'Media'/'.meta'/(i+'.json')).read_text(encoding='utf-8'))] if m.get('type')=='video']" "<the project folder>"
```

*One line on purpose: on Windows this is usually run from Git Bash, where a heredoc
mangles quoting and halves backslashes while still exiting 0. If you want it readable,
write it to a `.py` file and run it by path — never rebuild it as a heredoc.*

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

## The same settings across a whole batch

The usual job is not one GIF. It is a folder of clips that must all come out looking the
same — the person tunes one by hand in the app, hands you the numbers, and every clip gets
exactly those. Nothing here carries state between calls, so "the same settings" means
sending the same JSON each time. Two rules keep that honest:

- **Take the settings as given and change nothing.** If the person said `fps: 12`,
  `tolerance`, a `grow` of 2, do not round, re-derive or improve them per clip. A batch
  whose members were each quietly adjusted is worse than one that is uniformly slightly
  wrong, because nobody can tell which is which afterwards.
- **A per-clip failure stops that clip, not the batch.** Report which ones failed and why,
  by name, at the end. Do not retry a failed cut-out with different settings on your own:
  that silently breaks the uniformity the batch exists for.

A clip at a time, each step feeding the next through `output.itemId`:

```bash
# 1. video card -> GIF card
GIF=$(curl -s -X POST "$CUBRIC_URL/connector/gif/make" \
  -H 'Content-Type: application/json' \
  -d '{"videoItemId":"'"$VIDEO"'","fps":12,"sizePreset":"480xauto","loop":0}' \
  | python -c 'import sys,json; print(json.load(sys.stdin)["output"]["itemId"])')

# 2. the SAME cut-out settings on every one of them
curl -s -X POST "$CUBRIC_URL/connector/gif/cutout" \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"'"$GIF"'","method":"background","adjust":{"grow":2,"fillHoles":true}}'
```

Each call is awaited, and a cut-out is a real GPU run — BiRefNet measured around 16 s for
30 frames, SAM3 longer. A folder of clips is minutes, not seconds. Run them one at a time:
they share one GPU, so firing them in parallel makes the whole batch slower, not faster.

**Report what you cannot see.** The cut-outs may be clean on frame one and ragged in
motion, and no call here can tell the difference — say which clips were made, and that the
animation itself still needs an eye on it.

## Two things worth knowing before you plan a job

- **You cannot see the animation.** `POST /connector/describe` reads ONE still. If
  the user's judgement is about motion, flicker or pacing, say so and ask them to
  look — do not report a cut-out or a retime as "looking good".
- **A GIF is an image card.** It carries `gif: { frames, loop, output }` on its
  sidecar; everything else about it reads like any other image card, so the
  `cubric-vision-project-files` skill recovers its prompt and settings the usual way.
