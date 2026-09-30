# MPI-1003 Brief

Add-flow and add-model playbooks: the steps that make a new Flow or model known to the in-app
agent.

Umbrella: MPI-1000.

## Why

Fabio, 2026-09-30: a new Flow or model is unknown to Cosmo unless someone does the agent steps,
and today the playbooks barely name them. Seen the same day: in a fresh chat Cosmo declined a song
("I work with images and video only") because its prompt still called the app an image and video
tool; Song's three caption blocks and its voice casting reached Cosmo as bare field names, so it
filled them blind (MPI-1002).

## What the playbooks carry today

- add-model `03-model-registry.md` § "Rank it for the in-app agent" (`modelPriority.js`), and the
  README checklist line for it. Nothing else agent-facing.
- add-flow `01-descriptor-and-ops.md`: the `agentOpens` field (MPI-892). Nothing else.

## What the agent actually reads (audit this first, then write the steps)

- `list_models` (`services/agentLoop.mjs` catalogue: ranks, `best`, task, notes; Flows: id,
  title, installed, `opensForUser`) and `describe_model` (ops, params, media roles, a Flow's
  fields via `agentFieldSpecs` in `js/utils/declaredFields.js`: id, label, type, default, options.
  A hidden field reaches the agent as a bare name with no meaning).
- `read_knowledge`: the index and each guide (`docs/agent/*.md`, the model guides). A model with no
  guide id gets no prompting help; the `GUIDE_NOT_READ` gate only works when one exists.
- The system prompt's rules (Model rule, Flow rule, the opening line's product scope).
- `services/agentBench/connector-models.json` (the benchmark's model list).

## Candidate steps (settle the list from the audit)

- Flow: decide how Cosmo uses it (run, open for the user via `agentOpens`, or ask first like Song);
  a line in `docs/agent/flows.md` (app:flows) for when to reach for it and what its fields mean,
  especially hidden or structured ones (voices, markers, caption blocks); its id in
  `tests/agent-flow-handover.test.cjs`; a live ask in words ("can you make me a ...") that picks it.
- Model: rank (exists), a prompting guide id, cost and licence notes the agent must say, the bench
  list, and a live ask that picks it and reads its guide.
- A new MEDIA KIND (audio was one): the prompt's opening line and the Docs rule's scope.
- `/mpi-add-flow` and `/mpi-add-model` (the skills that enforce these playbooks) check the new
  steps, so a skipped one fails the checklist rather than the user.

## Where

`docs/playbooks/add-flow/` (README checklist, 01, 05-verify), `docs/playbooks/add-model/`
(README checklist, 03, 06-verify), the two skills' definitions, `docs/agent-chat.md` if a
pointer is needed. Docs and skills only; no app code unless the audit finds a missing hook.
