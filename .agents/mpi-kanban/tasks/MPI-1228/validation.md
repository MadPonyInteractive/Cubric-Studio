# MPI-1228 validation

## Reported (Fabio, 2026-10-21, project "test")

ILL Anime Beauty finished installing from the Models panel mid-chat. He asked Cosmo for a picture
on it; Cosmo raised "Install ILL Anime Beauty? Download: 0.0 GB". Yes -> the app answered
ALREADY_INSTALLED, Cosmo re-read the list and generated (ComfyUI restarted once for the new nodes,
which is the normal first-run path, not part of this bug).

## Root cause

`app.log` (dev profile) timeline: download done 11:41:33, renderer re-synced install state; at
11:42:39 the ONLY `agent.list-models` of that turn is `install_model`'s own gate read, so Cosmo went
straight to install_model off an older list_models answer in its context (from before the
download). The gate re-read the live list, which said installed (0 GB missing), and raised the
card anyway: Cosmo's `install_model` model branch never read `m.installed`. Its two twins already
do: the Flow branch (`installFlow(id, false)` -> ALREADY_INSTALLED) and the MCP `install_model`
(`routes/mcp.js`, ALREADY_INSTALLED). No catalogue cache is involved: every list_models,
describe_model and install_model call re-reads `GET /connector/models` live.

## Fix

`services/agentLoop.mjs` `_executeTool` `install_model`: a model the re-read says is installed
answers ALREADY_INSTALLED ("installed since your last list_models, go on") with no card, so the
model generates in the same turn.

## Evidence

- New test `tests/agent-loop.test.cjs` (a) "a model installed outside the chat gets
  ALREADY_INSTALLED, and no card": before the fix it hangs on the unanswered card (red, killed at
  the 120 s timeout); after, it passes with the other install-gate tests (5/5).
- `npm run lint` exit 0; `npm test` 3496 pass, 0 fail. Code commit 915fb3fc3.

## Not changed

A cloud model with no key (installed false, 0 GB) still gets a 0 GB card, where the MCP twin says
NOTHING_TO_DOWNLOAD. Separate, pre-existing; not this report.
