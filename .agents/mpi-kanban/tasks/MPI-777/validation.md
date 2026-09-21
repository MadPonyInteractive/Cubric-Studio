# MPI-777 Validation

## Phase 2 - the shared clip queue (2026-09-21)

Built. `js/utils/mascotClipQueue.js` + `tests/mascot-clip-queue.test.cjs`. Nothing is wired to
it yet, so there is no UI to look at - this phase closes on the unit test the plan asked for.

### What ran

- `node --test tests/mascot-clip-queue.test.cjs` - **8 pass, 0 fail.**
- `npm test` - **1688 pass, 0 fail**, 1 skipped (pre-existing) and 1 todo (MPI-867, red by design). 1690 total.
- `eslint` clean on both new files.

### The shape, and why it is DOM-free

It matches `createPreviewClipPlayer` (`js/services/previewClipPlayer.js`): a factory taking a
`paint` callback, touching no pixels itself. That is what makes the four rules unit-testable at
all, and it is what keeps the queue independent of the format decision - the same queue drives a
still, a GIF or an alpha WebM.

**Driven by a duration clock, never a media `ended` event.** Load-bearing, per Current State: a
GIF in an `<img>` cannot report that it ended, so an `ended` design would work only if the format
went one way and would silently foreclose the other.

### Every guard proven RED on a broken rule, one mutation at a time

A suite covering N rules proves ONE unless each is backed out separately. Each mutation was
applied alone, the matching test run, then the source restored and its sha256 checked.

| Rule broken | Guard | Result |
|---|---|---|
| no-immediate-repeat `while` removed | "never repeats" | RED |
| a waiting request applied at once | "waiting request" | RED |
| play-once no longer hands back to rest | "hands back" | RED |
| interrupt swaps with no transition | "interrupt starts" | RED |
| `destroy` stops clearing timers | "destroy clears" | RED |

Source restored byte-identical after every one (sha256 `6dc764732adbc768...`).

### One guard was ASLEEP, and rewriting it is the real finding

The first `destroy` test asserted "nothing painted afterwards" and **passed under the mutation**.
`_after` already refuses to run its callback once `_dead` is set, so effects are suppressed
whether or not the timers were cleared - the assertion could not see the difference.

What an uncleared timer actually does is worse than a wrong paint: the chain **re-arms itself for
ever and holds the event loop open**, so the process never exits. That is a HANG, not a failure -
no output, no failing test, nothing to read. It happened here for real: the preload test did not
mock timers, armed a live 5s chain, and hung the whole run with an empty output file.

The guard now stubs `globalThis.setTimeout`/`clearTimeout` and asserts every armed id was cleared,
which catches the mutation. `mock.timers` cannot be used for it - the `_dead` flag hides the
symptom from any time-advancing assertion.

### Not done in this phase, on purpose

Nothing is mounted. `heroCrew.js` still drives `_poseSrc` directly; putting the crew on the queue
is Phase 3, and the two ledges are Phase 4. The queue has no consumer until then.
