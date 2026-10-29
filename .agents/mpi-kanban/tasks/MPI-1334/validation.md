# MPI-1334 validation

## What went wrong (live, 2026-10-29, "Video edit showcase")

- Every Video Edit run Cosmo sent had `positive` = the whole edit as an H3 prompt ("replace the
  woman with the demon lady from <image1>: ... speaking her line clearly with natural lip
  movement; and replace the background ..."), while the app's describer already put the picture
  into `Input_Look`. `app:flows` says the opposite; the "Flow rule: read app:flows" had no gate.
- Every run had `Input_Quality: 2088960` (1080p, default 576p): asked for once, then saved in a
  project note as the setting to use and reused.

## Fix

- `services/agentLoop.mjs`: a Flow `generate` answers `KNOWLEDGE_NOT_READ` until `app:flows` is
  read, before the batch / review / open paths (same shape as `app:upscaling`).
- Memory rule: a setting asked for on one run is that run's only, never noted as the one to use.
- `docs/agent/flows.md`: fields are never a model prompt; unnamed fields keep their default;
  Video Edit `positive` with a picture is empty or a short correction; `Input_Quality` out unless asked.
- `docs/agent-chat.md` § Gates names the new gate.

## Evidence

- `node --test tests/agent-loop.test.cjs tests/agent-prompt-budget.test.cjs`: 240 pass, 0 fail
  (new test "a Flow waits until app:flows is read"; Memory rule asserts the one-run clause;
  system prompt budget 13,119 -> 13,283 with the reason).
- `npm run lint`: clean. `npm test`: 3801 pass, 0 fail.
- Not checked live: a Cosmo chat in the running app (user's `:3000` not touched).
- CI run 40812360629 on 062002104: success.
