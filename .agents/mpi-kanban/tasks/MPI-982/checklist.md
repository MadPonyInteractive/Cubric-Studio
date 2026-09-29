# MPI-982 checklist

Decision: an in-flight frame registry (`holdFrames()` in `services/gifFrames.js`), not a grace
window. A window is a timeout with a guessed N, and a GIF Maker build or a long cut-out has no
upper bound to check N against. Same shape as MPI-976's `itemsInFlight`.

- [x] Test, trigger 2: an empty (mid-write) sidecar makes the sweep delete nothing - red first
- [x] Test, trigger 1: frames held by a writer whose sidecar has not landed survive a sweep - red first
- [x] Test: a hold taken while a sweep is deleting that hash waits for it, so the frame is rewritten
- [x] `sweepGifFrames`: an unreadable sidecar skips the delete pass; held hashes are kept; sweeps run one at a time
- [x] Every writer holds its frames from first write until its sidecar lands: `/gif/ensure-frames`,
      `/gif/entry` (both modes), `/gif-cutout/apply`, `/gif/make`, `/gif/maker`, `/gif/crop`,
      `/gif/resize`, `.gif` upload/import, add-from-cards copy
- [x] `docs/gif.md` sweep section says so
- [x] Full `npm test` green
- [x] Code commit by explicit paths, pushed (f74c72dd5); CI green on it (run 36565386617); board close committed separately
