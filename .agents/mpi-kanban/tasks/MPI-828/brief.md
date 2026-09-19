# MPI-828 — Flow Library drawer: no licence attribution row for gated models

Found by the close-out claim audit, 2026-09-19, while assessing an unrelated provider.
Not found by a bug report — nobody has hit it yet, which is why it survived.

## Read this first: consent is NOT broken. Do not "fix" it.

The acceptance gate works. `js/services/downloadService.js:102-110` calls `showLicenceGate`
for any model carrying a `MODEL_LICENCES` entry, on **every** install path including a Flow's.
Receipts are keyed by licence id, so a user who already accepted while installing the model
directly is not re-prompted by the Flow. Both H3 variants (`minimax-h3`,
`minimax-h3-ref2va`) and `klein-9b` are registered in
`js/data/modelConstants/licences.js:471-476`.

A previous reading of this issue was that H3 "has no gate". **It does.** Starting from that
premise will send you to rebuild something that already works.

## What is actually missing

**Attribution display**, on the Flow surface only.

`MpiModelManager`'s detail drawer renders the licence name, the required `poweredBy`
attribution, and the licence / authorization / report-misuse links —
`js/components/Organisms/MpiModelManager/MpiModelManager.js`, `#detail-licence-row`.

`MpiFlowLibrary`'s slide-over renders none of it. It reuses the same `.mpi-detail__*`
classes, so the markup ports directly.

## Why it matters

H3 §III.3.a and §IV.2 oblige attribution **on the surface where the model is presented**.
For a user who reaches H3 through a Flow, that surface is the Flow Library drawer — they may
never open the Model Library at all. We committed to §III.3.a explicitly in the authorization
request granted 2026-08-05 (`docs/models/h3/README.md` § Licence).

**Scope is wider than H3.** Any gated model reachable through a Flow has the same hole,
Klein 9B included. Fix the drawer once, not per model.

## Where it was already written down

`docs/playbooks/add-flow/01-descriptor-and-ops.md:200-208` names this exactly, ending
"nobody has needed it yet". That stopped being true once a Flow shipped on a gated model.
That playbook note is the spec — read it before designing anything.

## Definition of done

- The Flow Library slide-over shows the licence row for a Flow built on a gated model, with
  the same fields `MpiModelManager` shows.
- A Flow built on an **ungated** model shows no row, and no empty container.
- Verified in a real app instance, not only a unit test — this is a render-site bug on a
  surface a user looks at.
- `docs/playbooks/add-flow/01-descriptor-and-ops.md` updated so the "nobody has needed it
  yet" note no longer describes the code.

## Related

- `docs/models/h3/README.md` § Licence — the obligations and what discharges each.
- MPI-451 — built `MpiLicenceGate` and the consent chokepoint.
- MPI-357 — the `verify` licence flow for Klein 9B.
- `docs/proprietary-models-research/01c-comfy-platform.md` § H3 — where this surfaced.

## Note for whoever picks this up

`docs/models/h3/README.md` contradicts itself and was not corrected on this card: § Licence
says the weights are "NOT on R2 and must never be", while § Weights in the same file says
four of the six are R2-primary and "never R2 no longer holds". The § Weights line is the
current one. Worth a separate card; it misled an agent on 2026-09-19.
