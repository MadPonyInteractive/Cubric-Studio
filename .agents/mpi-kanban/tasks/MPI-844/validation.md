# MPI-844 — validation

## Proven RED on the pre-fix code

Six source files swapped to their `HEAD` blob, tests kept new, restored byte-exact after:

| Assertion | On HEAD | Fixed |
|---|---|---|
| `/gif/entry` card for 200×80 frames at `maxEdge: 100` | `{w:200,h:80}` | `{w:100,h:40}` |
| `/gif/crop` card for a 405-wide crop, nothing capped | `{w:405,h:723}` | `{w:406,h:723}` |

Both are the exact wrong numbers the label was showing, and the second proves the fault is
NOT only `maxEdge` — the build's `-2` free edge moves an odd edge with no cap in play.

## Suites

- **92/92 GIF node tests** — `gif-frames`, `gif-transform`, `gif-cutout`, `gif-make`,
  `gif-maker`, `gif-timing`, `gif-preview`, `gif-frame-masks`, `connector-gif`,
  `connector-gif-jobs`.
- **23/23 GIF desktop specs** after the assertion below was corrected.
- Lint clean on all nine files.

## The one test that had to change, and what it exposed

`tests/desktop/gif-transform.spec.js:170` asserted a 9:16 crop lands a `1080×1920` card.
With the label honest it reads **576×1024** — because `_writeNewGifCard`'s default
`maxEdge` is 1024 and the crop is 1920 tall. The frames stay full-res (the next line
asserts 1080×1920 on the frame PNG), and GIF to Video further down the same spec still
produces a 1080×1920 video, because that route builds from the frames and never from the
built `.gif`.

**So Crop's card was overstating its file by nearly 2×, and had been since it shipped.**
This is pre-existing behaviour that the honest label merely made visible — see Open
question below. Nothing about the built files changed in this card; only what the UI
claims about them.

## What was removed

`frameDimensions()` in `services/gifFrames.js` lost its last caller and was deleted with
its export. Its doc comment claimed "routes that land an entry from existing frames read it
here", which was exactly the bug.

## Open question for Fabio — ANSWERED, see MPI-847

Every crop and resize defaults to `maxEdge: 1024`, so a full-res 1080×1920 crop silently
builds a 576×1024 `.gif`. That default predates this card and may well be right for a
format meant to stay small, but it is now legible on the card and worth a decision: leave
it, raise it, or expose it on the Crop/Resize panels the way GIF output exposes it.

**Fabio answered the same day: raise it to 2048.** Done in MPI-847 — as a FLOOR on the
inherited cap, because the route's own default was never what fired.

## Closed

Committed `79bcf0cd`, pushed, and **CI GREEN on its own commit** (run 35505263447).
