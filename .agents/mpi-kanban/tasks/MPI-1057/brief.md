# MPI-1057 brief

Written by MPI-623 session 44 ("3D Scene 34", 2026-10-10), which found these live and handed the card
over without touching code. Fabio: fix right away; every further Pod issue goes on THIS card.

## What happened (evidence)

- 08:33Z and 08:58Z: two RTX PRO 6000 Pods (EU-RO-1, volume `lpja78wof3`, image
  `v0.26.0-dev-cu130`, 105 GB container disk) sat 4-8 min with an EMPTY RunPod System log - the
  host never started the container. A PRO 4500 (09:11Z) and a 5090 (09:19Z) with the SAME image and
  disk started pulling within seconds (ready in 3m47s and 1m16s). So the stall is RunPod's PRO 6000
  hosts in EU-RO-1, not our image or disk. The app billed the whole time.
- Cancel (09:02Z) sent `/remote/pod/delete-active`; RunPod's DELETE hung on the stuck Pod until
  Fabio pressed Stop in the console; it returned 204 at 09:04:02Z. The panel gave no sign it was
  still waiting.
- During the 08:58Z connect the home strip (`js/shell/heroStats.js`) read `LOCAL · OFFLINE` + the
  local GPU + `0 / 24` while Settings said "Remote engine: connecting…". heroStats HAS a
  `connecting · offline` + % state (MPI-73/87/274), so a `remote:connection` emit with `phase:null`
  cleared it and nothing re-set it. No `[settings]` warning fired. Cause NOT proven. At 09:11Z (PRO
  4500) the strip read `CONNECTING · OFFLINE 0%` and `5 / 24` - correct, so it is intermittent; the
  08:58Z connect came 2 min after a CPU Pod was deleted (08:56:13Z).
- Weak lead only: the feed tick in `js/shell.js` (~line 1368) forces `phase:null` every tick while
  `state.remoteWaitGpu` is set, and Settings' `_applyEngineStatus` skips its refresh while
  `_engineBusy` - that combination matches the screenshot exactly, but the log shows no auto-retry
  wait this morning.
- Stage-on-connect queued "15 file(s) for 3 model(s)" on both healthy Pods although the volume holds
  ~80 GB of weights - may be the 2026-10-10 "every model reads NOT installed" mystery (MPI-623
  plan.md Current State) coming back. Unverified.

## Agreed with Fabio

1. **Stall cap: 8 minutes** (Fabio, 2026-10-10). A Pod not ready by then is deleted by the app, with
   a plain message: RunPod's host never started it, nothing on the user's side, try another GPU.
   Today only EXITED/TERMINATED/ERROR and a maintenance flag auto-delete; the "taking longer than
   usual" hint never cancels. A B300 at ~$6/hr must not bill open-ended.
2. **Find an early signal.** RunPod's public REST has NO log endpoint (checked `rest.runpod.io/v1/
   openapi.json`); a Pod exposes `desiredStatus`, `lastStartedAt`, `lastStatusChange`, `machine`,
   `publicIp`, `portMappings`. `_podRuntimeStatus` already fetches the Pod each poll during boot but
   logs nothing: log those fields on change, compare a healthy boot with the next stall, and kill a
   dead Pod in ~1 min if a field differs.
3. **Log every connecting-phase change with who changed it**, so the next LOCAL · OFFLINE names its
   own cause in app.log. Then fix the cause.
4. **Cancel feedback** while RunPod's DELETE is still pending.
5. **0 / 24** during a connect - explain and fix.

## Rules for this card

- Never curl or drive Fabio's app on :3000; read `%APPDATA%/Cubric Studio/logs/app.log` only.
- His app runs from this repo with no hot reload: edits land on his next restart.
- A Pod costs money: state the price before creating one.

## Noticed
