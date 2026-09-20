# MPI-847 — Crop and Resize floor their longest edge at 2048

Fabio, 2026-09-20, straight out of MPI-844's finding.

## Why the obvious change would have been a no-op

"Raise the crop maxEdge to 2048" reads like `routes/gifTransform.js`'s
`Number(output?.maxEdge) > 0 ? ... : 1024` fallback. That fallback almost never fires:
`MpiGroupHistoryBlock._postGifEntry()` posts `output: currentItem.gif?.output` with EVERY
transform, so a crop inherits the source entry's cap. In Fabio's chain that cap came from
Make GIF (`routes/gifMake.js:133` stamps `maxEdge: 1024`) and was inherited through every
later entry.

So the ceiling had to stop being inheritable downward, not just get a bigger default.

## The change

`TRANSFORM_MIN_MAX_EDGE = 2048` in `routes/gifTransform.js`, applied as a FLOOR:

```js
maxEdge: Math.max(Number(output?.maxEdge) > 0 ? Number(output.maxEdge) : 0, TRANSFORM_MIN_MAX_EDGE)
```

A floor, not a replacement — an entry that already allows more (a 4096 output, say) keeps
its own value. The frames in the store were always full-res; only the build ceiling was
throwing pixels away.

Deliberately NOT touched: `gifMake`'s 1024, the panel default, `DEFAULT_MAX_EDGE`, and the
`gif.js` / `gifCutout.js` fallbacks. Raising Make GIF's stamp would make every new GIF
bigger for everyone — a weight decision Fabio has not asked for. This is scoped to the two
operations where picking a region at full resolution and getting back half of it is the
surprise.

**Known consequence, stated rather than hidden:** a user who deliberately sets a SMALL
longest edge in GIF output and then crops gets 2048 back, not their 512. GIF output is a
separate tool they can re-apply, and the alternative — honouring a low inherited cap — is
exactly the behaviour this card exists to remove.

## Verification

**Verify mode:** auto

- `tests/desktop/gif-transform.spec.js` — the 9:16 crop of 1080×1920 frames now builds at
  full size. It asserted `{1080,1920}` before MPI-844 (wrongly, off the frame store),
  `{576,1024}` after it (correctly, off a capped file), and `{1080,1920}` now (correctly,
  off an uncapped one). Three different meanings for the same numbers.
- A node test pinning the floor against a source entry that asks for LESS.
- `node --test tests/gif-transform.test.cjs`, lint.

## Remaining Work

- [ ] The floor in `routes/gifTransform.js`.
- [ ] Desktop spec assertion back to `{1080,1920}`, with the reason.
- [ ] Node test: a source entry carrying `maxEdge: 512` must not cap a crop at 512.
- [ ] `docs/gif.md`.

## Current State

Implemented; tests pending.
