# MPI-855 — the spend readout

**Umbrella:** MPI-849 phase 2. Needs MPI-851 (which writes the cost).

**Verify mode:** `user-ux`.

## What Fabio asked for

How much the user has spent, and how much is left of the money they put into DeepInfra, for
the current month.

**Settled 2026-09-20:** an **append-only ledger in userData** is the panel's source, plus the
cost in the sidecar because one is written anyway. A sidecar-only history dies when a project
is deleted and would make the panel scan every project to render.

## Why the app must keep its own ledger

- Per-call truth is `inference_status.cost`, returned **only** on the native
  `/v1/inference` route. The OpenAI-compatible routes return `created` and `data` — dispatch
  there and the cost is simply gone.
- `GET /payment/usage?from=YYYY.MM` (seven characters, dot-separated; `rate` in **cents**)
  gives a month total per model but **cannot itemise token-priced image models** — the row
  carries a total and no unit count.
- **There is no cost or usage ledger anywhere in the app today.** And the provider's own usage
  object is already reaching the app and being discarded: the LLM engine returns
  `usage: data.usage ?? null` with a comment naming DeepInfra's `estimated_cost`, and only
  `prompt_tokens` is ever read.

## Mount

A fourth `.mpi-settings__form-group` at the foot of the **"Remote connection"** subgroup in
`MpiLlmSettings`, after the probe slot. Copy `_renderConnProbe` line for line: a `_conn()`
-registered `MpiButton` plus a `.mpi-settings__hint` written by `_setText`, `_errorText` for
the failure path, hidden when the profile is not `deepinfra` the way the key field hides for
`ollama`. **Fire on the user's click, never automatically on open** — see below.

## SECURITY — not optional, and the redactor cannot help

The balance lives on `GET /payment/checklist`, which **also returns the billing address and
card last4**. `routes/secretRedaction.js` is five regexes for key-shaped strings; a regex for
a name, a street, a postcode or a four-digit last4 is not writable. **Field-picking is the
only mitigation.**

The leak is two hops. `logger.*` → `app.log` → `/logs/read` and `/logs/download`, with 20 ×
256 KB archives; and separately any `ui:error` message → the error dialog → a **public GitHub
issue URL**. A renderer catch block is a server-log writer. The LLM engine already attaches the
whole upstream error body to thrown errors as `err.bodyText`, and a response body is already
proven to reach the error dialog.

The good news: **no request/response-body middleware exists**, so the exposure is entirely in
what this new route chooses to do.

**The established safe pattern:** build a new object at the route and name every field. The
purest example reads a fat upstream Pod object and answers five named scalars. Also rebuild any
thrown error so nothing rides out in `err.message`.

## Verify

The readout shows this month's spend and the remaining balance after a click; hides for a
non-DeepInfra profile; reads `NO_KEY` cleanly with no key saved. **And a test asserts the
route's response contains no `line1`, no `postal_code`, no `last4` and no `name`, and that
nothing reaching `logger.*` carries the upstream body.**
