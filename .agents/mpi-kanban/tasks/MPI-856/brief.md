# MPI-856 — run with no local engine

**Not a member of MPI-849.** Adjacent to it, and the door to the user that umbrella's models
are actually for. MPI-849 ships to users who already have ComfyUI and does not wait on this.

**Maturity: `research`.** The gate is one line; what sits behind it is the whole app. Audit
before estimating.

## The finding

`blockedByNoEngine()` (`js/services/engineGate.js:72`) emits a warning and aborts. It guards
**six** call sites:

| Call site | What it blocks |
|---|---|
| `js/shell/projectUI.js:261` | **creating a project** |
| `js/shell/projectUI.js:557` | **opening a project** |
| `js/shell.js:486` | the Model Library |
| `js/shell.js:501` | the Flow Library |

So without ComfyUI a user cannot reach a project, which means they cannot reach anything.

## Why it matters now

Cloud models need no engine. The user who most wants them — weak GPU, nothing installed,
happy to pay per image — is precisely the user the app turns away at the door. Fabio,
2026-09-20, on being asked whether to lift the library gate: *"that is a big thing... basically
everything that needs ComfyUI would need to trigger a toast instead of running."* He is right,
and that is why this is a card and not a line in someone else's plan.

## The shape of the work, before anyone estimates it

1. **Audit, do not guess.** Enumerate every surface that assumes a running engine: local model
   ops, every Flow, the canvas tools (mask, paint, composite, crop), upscale, enhance, the
   preview bus. The type-consumer sweep in `tasks/MPI-849/research/findings.md` § A is the
   starting map — it already lists the install/weights axis.
2. **Refuse at the point of use, with a named toast.** The established pattern is the
   three-layer one: absent from the strip, dim via `aria-disabled` (never the disabled
   attribute, so the status-bar hover still explains), then a hard net at dispatch with a
   `ui:warning` naming the thing and the fix. Copy `commandExecutor.js:1449-1464`.
3. **Decide what the project lifecycle means with no engine.** Creating and opening are
   gated today; both would have to succeed and then constrain what the project can do.
4. **Decide what the two libraries show.** A Model Library with no installable models is a
   different surface from one with a Paid section at the foot.

## Do not

- **Do not lift a single gate in isolation.** Dropping a user into a project where every local
  tool fails at the point of use is worse than the honest refusal they get today.
- **Do not fold this into MPI-853.** That card ships the Paid models section for users who
  have ComfyUI, and the gate stays exactly as it is.

## Verify

A user with no ComfyUI installed and a DeepInfra key saved can create a project, open it,
generate with a paid cloud model, and is told clearly and specifically — never by a failure —
why each local capability is unavailable. Every existing user with an engine sees no change
whatsoever.
