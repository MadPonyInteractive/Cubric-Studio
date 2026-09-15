# MPI-762 - grow the network volume from Remote settings

## Approach

1. `routes/runpodRemote.js`: `client.updateVolume(key, id, size)` sends
   `PATCH /networkvolumes/{id}` with `{ size }` (RunPod REST docs: size must be greater than
   the current size, max 4000 GB). Route `PATCH /runpod/volumes/:id` accepts only a whole
   number in 1..4000 and forwards `{ size }` alone; RunPod enforces grow-only.
2. `MpiRunpodSettings.js`: when the DC has a volume, a row under the badge with a
   "Size (GB)" `MpiInput` (floor = current size, step 10, max 4000) and an `MpiButton`
   Update, disabled until the value exceeds the current size. Click opens an `MpiOkCancel`
   confirm with the new monthly cost and "cannot be shrunk". Success reloads the volume
   list and re-renders the row (badge + disk bar).
3. Units: field, badge and disk bar are all RunPod decimal GB.

## Decisions

- Running Pod needs no restart: user confirmed 2026-09-15 that growing the volume in the
  RunPod console shows the new size in the app with the Pod running. The disk bar and the
  disk gate re-read the volume size on every call. No restart hint.

## Current State

- 2026-09-15: code, test, docs done and agent-verified (see `validation.md`). Uncommitted.
  Next: user grows a real volume from Remote settings; on "verified" run `mpi-end-session`.
- Gotcha for a future UI check: Playwright `win.route` did NOT intercept the renderer's
  `fetch` to the app server in this Electron run; an in-page `window.fetch` stub did.

## Remaining Work

User live check only.

## Completed

- Backend client + route, node test (3/3), settings grow row + confirm, docs section 5 bullet,
  isolated Electron check.

## Plan Drift

(none)

## Verification

**Verify mode:** user-ux

- `node --test tests/runpod-volume-update.test.cjs`: the route sends PATCH with `{ size }`,
  rejects missing, zero, fractional and over-4000 sizes without calling RunPod.
- Isolated app: row renders, field floors at the current size, Update enables only above it.
- User live check: grow a volume from the app, badge and disk bar show the new size.
