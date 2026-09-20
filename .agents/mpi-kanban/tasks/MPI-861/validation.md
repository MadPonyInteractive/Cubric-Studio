# MPI-861 validation

## Which test actually failed

The error-context header and the source window did not disagree. Playwright prints a
**200-line** source window in `error-context.md` (`# Test source`) and marks the failing
line inside it with `>`. A reproduced failure's context starts at line 356 and ends at
556, with `> 456` on the failing line — so a reader looking at the top of that block sees
`:352-366`, which belongs to the *previous* test, while `Location:` names the real one.

The failing test is the one the header named: **`gif stage: right-click reverses the
frames and clears every mask; Save frame is on it`** (`tests/desktop/gif-workspace.spec.js:402`
before this fix). The error shape confirms it independently — `Expected: true,
Received: false` can only come from a boolean poll, and the only boolean poll that sits
right after a `setTrackMasks()` is that test's `hasFrameMasks()`. The strip test's
equivalent poll asserts a COUNT and would have printed a number.

## Root cause

`Reverse` posts `/gif/entry`. The spec waited for the stub to record the REQUEST and then
planted masks. But the save is not finished at that point: `_postGifEntry`
(`MpiGroupHistoryBlock.js`) goes on to `/gif/ensure-frames` and then calls
`viewer.el.loadFrames(...)` with the new entry's frames. `loadFrames` runs `_syncMasks`,
and a changed frame signature makes every position-keyed mask meaningless, so
`GifFrameMasks.sync()` stashes the store and empties it (`gifFrameMasks.js:55`).

So the masks the test had just planted were wiped a beat later, and `hasFrameMasks()`
polled `false` for its full 5s against a store that would never refill. Whether the reload
landed before or after `setTrackMasks` is pure timing — hence one failure in four, and only
when the run is loaded enough to jitter (both gif specs together).

Nothing in `MpiGifViewer`/`GifFrameMasks` is wrong here: dropping position-keyed masks on a
new frame list is the documented contract. The defect was the spec treating "the request
was sent" as "the operation is done".

## Proof (red, then green, on the same forced race)

Two temporary probes, both reverted before the fix was committed:

1. `/gif/ensure-frames` stub honours `window.__mpi769.delayMs`, set to 1500 before the
   Reverse click — the reload now lands late instead of at random.
2. `await window.waitForTimeout(2500)` between `setTrackMasks()` and the `hasFrameMasks()`
   poll — the test now reaches the poll *after* the late reload, deterministically.

**Without the fix**, that run reproduces the reported failure verbatim:

```
Expected: true
Received: false
Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
> 456 |     await expect.poll(() => window.evaluate(() => document.querySelector('.mpi-gif-viewer').hasFrameMasks())).toBe(true);
```

**With the fix**, the same two probes still in place: `1 passed (8.1s)`. The new poll waits
out the 1.5s reload before any mask is planted, so nothing arrives to wipe them.

Probe 1 alone passes either way — the test's tail finishes inside 1.5s, so the late reload
never reaches an assertion. That first negative is why probe 2 exists.

## The fix

One wait, on the post-condition the click actually produces: the viewer holds the reversed
frame list. No timeout was raised and no product code changed.

```js
await expect.poll(() => window.evaluate(() =>
  document.querySelector('.mpi-gif-viewer').getFrames().map(f => f.hash).join(',')),
'the reversed entry must be loaded before any mask is planted on it',
).toBe([...FRAME_HASHES].reverse().join(','));
```

The first test in this file already knew the trap — *"The stub records a call BEFORE its
response lands; the save's DOM effects come after, so wait on them rather than read them at
once"* — and waits on a DOM post-condition after both Update and Apply. A sweep of every
`calls.length` poll in `gif-workspace.spec.js` and `gif-cutout.spec.js` found the stage test
was the only site that skipped it, so this is the whole call-site set.

## Regression

`npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-cutout.spec.js
tests/desktop/gif-workspace.spec.js` run three times back to back: **16 passed** each,
1.1m each. Commit `6346d5ba`.

## Not MPI-859

`28beb3b0` is not implicated, as Fabio suspected. That test never sets a candidate mask, so
`gifFrameMasks.isProposalAt()` is false throughout and every branch MPI-859 added passes the
arguments the previous code passed.
