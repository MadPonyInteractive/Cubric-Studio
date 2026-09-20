# MPI-847 — validation

## The check that matters: the obvious change was a no-op

Before writing anything, `MpiGroupHistoryBlock._postGifEntry()` was read: it posts
`output: currentItem.gif?.output` with every transform. So `routes/gifTransform.js`'s
`|| 1024` fallback almost never fires — a crop inherits the source entry's cap, and in
Fabio's chain that cap came from `routes/gifMake.js:133`. Raising the fallback to 2048,
the literal reading of the request, would have changed nothing he can see.

Hence a FLOOR (`Math.max(inherited, 2048)`), not a bigger default.

## Proven RED without the floor

`routes/gifTransform.js` reverted to the plain `? : 1024` form, tests kept new, restored
byte-exact after:

```
✖ Crop floors its longest edge at 2048 even when the source entry asks for less
    actual: 1024, expected: 2048
```

The new test pins both directions: a source asking for 1024 is raised to 2048 (and a
1400-wide crop really builds at 1400), while a source asking for 4096 keeps 4096 — a
floor, never a replacement.

## Suites

- **11/11** `tests/gif-transform.test.cjs`.
- **1/1** `tests/desktop/gif-transform.spec.js`.
- Lint clean on all three files.

## The travelling assertion

`gif-transform.spec.js:170` has now meant three different things, which is worth recording
because the numbers repeat:

| | Asserted | Read from | Correct? |
|---|---|---|---|
| before MPI-844 | `{1080,1920}` | the frame store | no — the file was 576×1024 |
| after MPI-844 | `{576,1024}` | the built file | yes — and it exposed the cap |
| after MPI-847 | `{1080,1920}` | the built file | yes — nothing caps it now |

## Known consequence, not a defect

A deliberately small longest edge set in GIF output does not survive a later crop: the
floor raises it to 2048. Re-apply GIF output after cropping when a small file is the
point. Recorded in `docs/gif.md` beside the floor.

## Closed

Committed `43e1d90d`, pushed, and **CI GREEN on its own commit** (run 35505802176).
