---
name: cubric-vision-engine
description: Control the ComfyUI engine behind a running Cubric Vision app, and its RunPod remote GPU, over the local HTTP API - engine status, start, stop and VRAM unload, model folders and presence checks, creating, reconnecting, stopping and deleting a remote pod (a pod bills while it exists), pod cost, RAM, VRAM and disk telemetry, plus system, GPU, log and shell-integration routes. Use when asked to start or stop the engine or a remote pod, free VRAM, check which model files are present, or read pod cost and disk usage. Part of the cubric-vision skill family.
user-invocable: true
metadata: {"openclaw":{"emoji":"👁️","os":["win32","darwin","linux"],"requires":{"anyBins":["curl"]},"primaryEnv":"CUBRIC_URL"}}
---

# Cubric Vision: engine, RunPod and system

## Before anything else

Part of the Cubric Vision skill family; the entry point is the `cubric-vision` skill
([../cubric-vision/SKILL.md](../cubric-vision/SKILL.md)). Base URL `$CUBRIC_URL`,
default `http://127.0.0.1:3000`. Nearly every route is `POST` with a JSON body. Check
the app is up first with `curl -s -m 3 "$CUBRIC_URL/comfy/status"`: a refused
connection means Vision is not running. There is no auth on loopback; remote-pod tokens
are attached server-side, so never ask a user for one.

## Engine control

| Verb | Path | Purpose |
|---|---|---|
| GET | `/comfy/status` | Engine up, and the readiness probe for this skill |
| POST | `/comfy/start`, `/comfy/stop` | Engine lifecycle |
| POST | `/comfy/unload` | Free VRAM; body `{ "deep": true }` for a deep release |
| POST | `/comfy/needs-restart` | Whether a restart is pending |
| POST | `/comfy/refresh-models` | Re-scan model folders |
| GET | `/comfy/list-files`, `/comfy/model-folders`, `/comfy/extra-folders` | Model inventory |
| POST | `/comfy/models/check`, `/comfy/models/check-local` | Presence checks |
| POST | `/comfy/import-model` | Import weights |
| GET | `/comfy/get-path`, POST `/comfy/set-path` | Models root |
| GET | `/comfy/events/stream` | Server-sent events for live progress |

`/comfy/events/stream` is an SSE endpoint and the right way to watch a long
operation rather than polling.

**`/comfy/set-path` rewrites a single global `extra_model_paths.yaml`.** Two
processes touching it concurrently will race. Do not call it as a side effect of
anything else.

## RunPod remote engine

Vision drives a remote GPU while the app stays local. It deploys a Cubric-owned
Secure Cloud pod running a FastAPI wrapper in front of ComfyUI, reached through
RunPod's HTTP proxy. Community Cloud is unsupported.

| Verb | Path | Purpose |
|---|---|---|
| GET, POST | `/remote/mode` | Read or set remote mode |
| GET | `/remote/pod/specs` | Available pod specs |
| POST | `/remote/pod/create` | Create a pod |
| POST | `/remote/pod/reconnect` | Reattach to a running pod |
| POST | `/remote/pod/stop-active` | Stop, keeping the volume |
| POST | `/remote/pod/delete-active` | Delete |
| POST | `/remote/pod/teardown`, `/cleanup-orphans` | Clean up |
| GET | `/remote/pod/stats` | RAM and VRAM telemetry |
| GET | `/remote/pod/disk` | Volume bytes used |
| GET | `/remote/pod/ls` | File listing plus an `accounting` block |
| GET | `/remote/comfy/status` | Remote engine health |

**A pod bills while it exists.** Treat `create` and `delete-active` as actions
that spend the user's money, confirm before calling either, and tell the user
plainly when a pod is left running. `stop-active` keeps the volume, which still
costs something; `delete-active` does not.

`/remote/pod/stats` and `/remote/pod/disk` are the honest source for how long a
session ran and what it used, which is worth more than an estimate when a cost
figure is going to be quoted anywhere.

`/remote/pod/ls` returns `accounting` with `blockBytes`, `apparentBytes` and
`phantomBytes`. During a large download the two byte figures diverge because a
partial `.part` file counts toward one and not the other. **Both halves must come
from the same response** — `/remote/pod/disk` caches its measurement for 60
seconds, which at pod download rates is gigabytes of drift.

## System

| Verb | Path | Purpose |
|---|---|---|
| GET | `/system/stats` | Host stats |
| GET | `/system/gpu-info` | GPU |
| GET | `/system/list-components` | Installed components |
| GET | `/system/platform-config` | Platform config |
| POST | `/open-folder`, `/reveal-item`, `/choose-folder` | Shell integration |
| GET | `/logs/read`, `/logs/download` | Logs |
| POST | `/logs/reveal` | Open the app log in the file manager |
| POST | `/github/issue-url` | Build a prefilled bug-report URL (no credentials; does NOT file anything) |

`/choose-folder` opens a **blocking OS dialog** on the user's desktop. Never call
it in an unattended run. `/logs/reveal`, `/open-folder` and `/reveal-item` pop a
file-manager window there too — same rule.
