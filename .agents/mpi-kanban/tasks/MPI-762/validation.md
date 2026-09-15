# MPI-762 validation

## 2026-09-15 - offline (agent)

- `node --test tests/runpod-volume-update.test.cjs` -> 3 pass, 0 fail. `client.updateVolume`
  sends `PATCH https://rest.runpod.io/v1/networkvolumes/vol-1` with body `{ size }` only; the
  route forwards a valid size (extra `name` dropped) and passes RunPod's 200 and 400 through;
  missing, 0, negative, 60.5, "60" and 4001 get `400 invalid_size` with RunPod never called.
- Regression: `node --test` over `runpod-volume-update`, `pod-cpu-flavors`,
  `runpod-remote-hardening`, `pod-disk-total` -> 29 pass, 0 fail.
- `npx eslint` on the settings component, `routes/runpodRemote.js` and the new test -> clean.
- Isolated Electron (own E2E profile and port, throwaway Playwright spec, in-page fetch fixture:
  one 60 GB volume in EU-RO-1, key check stubbed) -> passed, no page errors. Field starts at 60,
  Update disabled at 60, 50 and 65.5, enabled at 80; confirm reads "from 60 GB to 80 GB",
  ~$5.60/month, cannot be shrunk; OK sent exactly one `PATCH {size: 80}`; badge re-rendered to
  80 GB, field floor moved to 80, Update disabled again. Screenshots checked by eye.

## 2026-09-15 - live (user-run) - PASSED

- User grew a real network volume to 70 GB from Remote settings: the badge updated right away;
  the disk bar hid (the re-render remounts it, hidden until its first poll) and came back with
  the new total. User: "looks good".
