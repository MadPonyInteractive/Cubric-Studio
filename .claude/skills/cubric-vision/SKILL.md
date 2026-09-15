---
name: cubric-vision
description: Drive a running Cubric Vision desktop app from an agent over its local HTTP API - list and create projects, add and read media, inspect and edit generation metadata, control the ComfyUI engine, and create, monitor and stop a RunPod remote GPU. Use when asked to work with a Cubric Vision project, add or fetch assets from one, check what a project contains, start or stop the engine or a remote pod, read pod cost and disk telemetry, or automate any Vision workflow. Also covers the on-disk project format so a project can be read without the app running - including how to recover the exact prompt, negative prompt, model and settings behind any generated image from its sidecar (they are NOT in the PNG and NOT in project.json), which is the read to do before advising on any prompt. Read this skill before helping a user iterate on a generation: it sets the rule that prompts are handed back whole and pasteable, never as fragments to splice. Dispatches image and video generations that land as real gallery cards, including edits, image-to-video and reference-image ops fed with your own images (Klein Edit with up to three references) - see Dispatching a generation. Also runs Flows, which is how TEXT-TO-SPEECH is reached: use this skill whenever asked to generate speech, a voice-over, a spoken line, a narration or any audio from text with Cubric Vision, or to clone or match a voice from a sample - the two TTS surfaces are Flows and not models, so they are unreachable by model id. Covers supplying your own audio, image or video file to a generation from another repo, by staging it into the project first.
user-invocable: true
metadata: {"openclaw":{"emoji":"👁️","os":["win32","darwin","linux"],"requires":{"anyBins":["curl"]},"primaryEnv":"CUBRIC_URL"}}
---

# Cubric Vision

Cubric Vision runs an Express backend on loopback. Everything below is reachable
with plain HTTP from any agent on the same machine, no SDK and no MCP server.

This skill is one of a family. Cubric Studio is the agentic hub that orchestrates
the Cubric apps through skills like this one; each app gets its own, in the same
shape.

## Before anything else

**Base URL**: `http://127.0.0.1:3000`, overridable with `CUBRIC_PORT`. Resolve
`$CUBRIC_URL` first if it is set, otherwise use the default.

**Almost every endpoint is `POST` with a JSON body**, including the ones that
only read. `/list-projects` and `/get-project` are POSTs. Do not assume REST
conventions; use the verbs in the tables below.

**Check the app is up before doing anything else.** A connection refused means
Vision is not running, and nothing here will work:

```sh
curl -s -m 3 http://127.0.0.1:3000/comfy/status
```

There is no auth on loopback. Remote-pod tokens are attached server-side and
never reach a client, so never ask a user for one.

## Hand over whole prompts, never fragments

When a user is generating and you are advising, **every prompt you give back is
the complete text, ready to paste over what is in the box** - positive in one
block, negative in a second block, both whole even when only six words changed.

Never hand over a fragment, a diff, a "add this to the end", or a "swap X for
Y". The user is at the app with a pod running. Finding the insertion point in a
400-word prompt costs them more time than reading a full one, gets spliced wrong
under time pressure, and a wrong splice burns a paid generation.

This applies to the negative prompt too, and it applies when the change is
trivial. If you do not have the current prompt text, **read it from the sidecar
first** (see [on-disk-format.md](on-disk-format.md) § Recovering the prompt behind an
image) rather than asking the user to paste it.

Say what changed in one line *after* the blocks, never instead of them.

## Where everything else lives

Each file is self-contained. Open the one the task needs, not all of them.

| Task | Read |
|---|---|
| Projects: list, create, open one, update the record; the media routes | [projects.md](projects.md) |
| A project with no app running: `project.json`, sidecars, naming vs notes, **recovering the prompt behind an image**, the reference-slot load list | [on-disk-format.md](on-disk-format.md) |
| Dispatching a generation: `/connector/generate`, named params, **reference images on a model op**, error codes, the `modelId` trap | [generating.md](generating.md) |
| Running a Flow and text-to-speech, including supplying your own audio, image or video | [flows.md](flows.md) |
| Engine control, the RunPod remote engine (a pod bills while it exists), system and shell routes | [engine-and-remote.md](engine-and-remote.md) |

## Connector

`/connector/*` is the agent's generation surface. Three routes are yours:

| Verb | Path | Purpose |
|---|---|---|
| GET | `/connector/capabilities` | `{"generationSubmit": true}` when an app window is listening, so a submit has somewhere to land |
| POST | `/connector/generate` | Run a model op or a Flow into a real gallery card: [generating.md](generating.md), [flows.md](flows.md) |
| POST | `/connector/open-project` | Make a project the open one before generating: [projects.md](projects.md) |

`/connector/jobs/stream` and `/connector/jobs/:id/result` are the app window's own
relay, never an agent's. There is no `/connector/enhance` any more, and no
`prompt.enhance`, `system.memory.release` or `system.shutdown` capability.

Call `/connector/capabilities` rather than trusting this file; it is the live
answer and this file is a snapshot.

## Tests

```sh
npm test               # unit suite, node --test, ~9s
npm run test:desktop   # Playwright/Electron UI specs, ~1.2 min
```

`node --test tests/` does **not** work; Node reads the bare directory as a module
and fails. Use `npm test` or the glob form `node --test tests/*.test.cjs`.

Neither suite runs a ComfyUI workflow, has a GPU, or dispatches a graph. Green
tests do not mean generation works.

Test **files** run in parallel, so anything writing global on-disk state races.
A new test that writes engine state must set `CUBRIC_ENGINE_ROOT` to its own temp
directory before requiring the comfy routes.

## Docs worth reading before deep work

In the Vision repo, all under `docs/`: `runpod-remote-engine.md`,
`generation-lifecycle.md`, `data.md`, `flows.md`, `testing.md`,
`project-integrity.md`, `model-library.md`, `events.md`.

Verify a named file, route or field still exists before relying on it. This file
is a snapshot of a moving app, and the live answers are `/connector/capabilities`
for capabilities and the route files under `routes/` for everything else.
