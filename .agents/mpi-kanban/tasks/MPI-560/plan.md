# MPI-560 — The Flow track: one umbrella

Merged 2026-08-16 at Fabio's request. Three overlapping Flow umbrellas existed —
MPI-529 (Flow Library v2), MPI-552 (the LTX v2v trio) and MPI-560 (community Flows).
They were one track split three ways: every one of them ends up editing
`js/data/flowsRegistry.js`, and every one of them was gated on the same `FlowStepField`
work. **MPI-529 and MPI-552 are deleted; this card is the only Flow umbrella.**

**Second merge, 2026-08-16, same session:** MPI-530 (character consistency at the bench)
was deleted into this card too, on Fabio's call that every Flow-related card belongs in one
place. Its two members — MPI-348 (Krea2 swap family) and MPI-504 (character sheet) — are now
direct members here as phase 4. They are the only members that are **bench** work rather
than app wiring: authored by Fabio in the ComfyUI node graph, not dispatchable file edits
against `js/data/flowsRegistry.js`. That distinction is a scheduling fact, not a reason to
split the track again — see phase 4.

**The member cards stay on the board.** Nothing was closed or merged to make this. Close a
member when the phase covering it lands, and say so in its card.

## Members

| Card | What it is | Phase |
|---|---|---|
| MPI-332 | Rip the 3 deprecated test flows (image-regen, sdxl-4k, video-stitch) — keep Head Swap | 1 |
| MPI-531 | Package-ready Flows for 1.5 — the authoring shape. **1.5 RELEASE BLOCKER** | 2 (partly landed) |
| MPI-536 | LTX 2.3 foley Flow — **shipped, `validating`** | 3 |
| MPI-520 | LTX 2.3 v2v extend Flow — **shipped, `validating`** | 3 |
| MPI-538 | LTX 2.3 lipsync Flow | 3 |
| MPI-504 | Character sheet — attributes or a reference photo in, a video-reference sheet out (front body HEADLESS). **Bench** | 4 |
| MPI-348 | Krea2 swap family: face / head / character. **REJECTED 2026-09-14** (Krea very bad in Fabio's tests; Head Swap ships on Klein 9B distilled, MPI-744) | 4 |
| MPI-748 | **Umbrella** (added 2026-09-13): Head Swap on Klein follow-ups — MPI-746 (Klein `euler` → `lcm`), MPI-747 (`Output_Display`), MPI-744 (Klein Head Swap Flow); MPI-745 (LTX video head swap) left it 2026-09-14 as a solo card. One card per session; order in `tasks/MPI-748/plan.md` | 4 |
| MPI-259 | Flows v2 — install / multi-model / reuse paths, UI design pass, 2nd flow | 5 |
| MPI-532 | Community flow packages — data-only folders in `user_flows/`. **Blocks 2.0** (MPI-780 phase 1) | 6 |
| MPI-798 | Flow developer kit — generated node lockfile + installer (split out of MPI-532). **Ready at 2.0 release** | 7 |
| MPI-799 | Community Flow registry — public GitHub repo, submissions reviewed by MPI. **Open at 2.0 release**; needs Fabio's decisions | 7 |
| MPI-831 | Flow Library: the **Third-party Flows** section, source badges, dimmed uninstalled tiles, and the two paid Gumroad tiles | 8 |
| MPI-841 | The Flow Library **browses the registry** — a user discovers third-party Flows in the app, never on a website | 8 |
| MPI-780 | **Umbrella**: the two PAID Flows — Head Swap and DramaBox leave the app (MPI-781, shipped) and sell as Gumroad packages. **Blocks 2.0**, gated as a four-link chain in MPI-595 Gate A | 8 |
| MPI-743 | A refused licence gate is a silent no-op — the tile just falls back to Install. Reaches a PAID buyer: Head Swap pulls the Klein 9B gate on first install | 8 |
| MPI-828 | No licence attribution row in the Flow drawer — H3 §III.3.a / §IV.2 owe it on the surface where the model is PRESENTED, and a Flow user may never open the Model Library | 8 |

**Adopted 2026-09-21 on Fabio's go** (MPI-595 Gate D asked for exactly this): MPI-780, MPI-743 and MPI-828 were loose Flow cards with no umbrella. 743 and 828 are the two that sit in a PAYING user's path — a silent no-op after a refused licence gate, and a missing attribution row — so they are release-shaped, not polish. Gate D also names **586, 591, 557, 355** as survivors still to adopt or to exempt; they were NOT swept here, because Fabio's go covered the cards in play, not the whole list.

Adjacent, deliberately NOT members: **MPI-455** (end-frame conditioning — op-side wiring on
the shipped `ltx_i2v.json`, not a Flow) and **MPI-533** (the tombstone ledger phase 5's
deprecation UX depends on — model-registry infrastructure, not Flow format).

## The one idea holding all of it together

`uiComponent` names a JS component, so a third party can never have one. Every Flow
authored with a new component is a Flow that must be ported later. So the authoring shape
is not preparation for the package format — **it is the package format, paid for a release
early, where it is cheap.** Keep the port surface at ONE component (`MpiFlowHeadSwap`),
which is what it becomes once phase 1 rips `MpiFlowImageRegen` with the three test flows.

Naming history when reading old prose: July text says "App"; everything shipped has been
"Flow" since `985faa09`.

## Phase 1: The rip (MPI-332)

Delete the three descriptors and everything only they touch — descriptors in
`js/data/flowsRegistry.js`, the workflow JSONs, `MpiFlowImageRegen`. Delete-only: the
frame, the carousel, Head Swap and the reuse routing all stay.

Grep each removed flow id across `js/` and `comfy_workflows/` before declaring done — a
descriptor removed while a workflow JSON or a reuse entry still names it is a half-rip.
Head Swap (MPI-299) is flow #1 of the real product and becomes the fixture everything
later is built against.

The Flow Library is dev-gated, so this is not user-visible and gates no release.

## Phase 2: The 1.5 authoring shape (MPI-531)

**Item 1 has LANDED** and needed more than the card said: field types alone unblock
nothing, because `fields` render on middle steps only and the run slide's controls came
solely from `props.uiComponent`. So slider / number / text shipped together with
`FlowDef.controls` — declared run-slide controls, `Input_*` ids routed into
`injectionParams`.

Still open:

- `steps[].image` — a per-step intro image alongside title / hint / tickerLabel, rendered
  by `MpiBaseFlow`. The ONLY new `FlowDef` field in the whole design; resist a second.
- Author 1.5's Flows declaratively via steps + fields. No new `uiComponent`.
- Port `MpiFlowHeadSwap` to declarative steps once its controls are expressible. Retiring
  the `uiComponent` field itself belongs to phase 5.

**Acceptance, checkable per Flow:** the `FlowDef` is fully expressible as a third-party
manifest — no JS component, `requiredModels`/`requiredDeps` are catalogue ids only, and
every media node carries an `Input_*` / `Output_*` title.

## Phase 3: The LTX 2.3 v2v trio (MPI-536, MPI-520, MPI-538)

All three ship as **Flows, not model ops** — no `ModelDef`, no `supportedOps`, no dep
entries; they run on the already-wired LTX 2.3 checkpoint (memory
`project_ltx_workflows_land_as_flows`). Route is `/mpi-add-flow`, never `/mpi-add-model`.
Shared injection contract, settled by MPI-537 phase 4: `Input_Video`, `Input_Audio`,
`Input_Positive`, `Input_Negative`, `Input_Seed`, `Output_Video`.

**Extend (MPI-520) and foley (MPI-536) have shipped** — both `validating`, both waiting
only on the user's live generation. Order changed from the original plan on a fact it did
not have: foley and lipsync each need a weight that is not a dep yet
(`ltx-2.3-22b-lora-foley-v2a-1.0`, `ltx-2.3-22b-ic-lora-lipdub-0.9`), so both are gated on
an R2 stage plus a `dependencies.js` entry. Extend needed no new weight, so it went first
and proved a Flow can ship with no JS component.

**Lipsync (MPI-538) is what's left.** Copy
`docs/playbooks/add-flow/existing-flows/ltx-extend.md` rather than re-deriving the shape.
Its injection contract is already correct, so it is mostly descriptor plus media I/O. Two
inherited facts:

1. **The weight prereq is real work and a mirror may not exist.** `ltx23-lora-foley` is the
   first LTX dep with **no `mirrorUrl`** — the only upstream copy
   (`Lightricks/LTX-2.3-22b-LoRA-Foley-V2A`) is GATED, `401` + `X-Error-Code: GatedRepo`
   anonymously. Check whether `Lightricks/LTX-2.3-22b-IC-LoRA-DubIt` is gated the same way
   before planning one.
2. **A Flow's weight goes on the tier that can run it, not on the family.** Foley's LoRA
   sits on `ltx-23-balanced` only, because the graph bakes the int8 transformer.

The foley-vs-voice mode decision is settled: **v1 ships foley only**; voice mode has never
been run. Lipsync inherits no guess.

## Phase 4: The bench track — where the next real Flow comes from (MPI-504, MPI-348)

Folded in from MPI-530 (deleted 2026-08-16). Phases 1–3 and 5–6 wire Flows into the app;
this phase is the only one that **invents** one. Both members are authored by Fabio in the
ComfyUI node graph, with the agent supplying node semantics, graph topology and the measured
regimes so nothing is re-derived at the bench.

Both are the same bet: **consistent characters with no LoRA training**, as Flows on Krea2
(memory `project_lora_free_character_system`). Both consume the same Krea2 knowledge —
`docs/models/krea2/injection.md`, `docs/models/krea2/resolution.md`, and the measured
`ref_boost` table in `docs/models/krea2/editing.md`, which MOVES: read it there, never cache
the numbers.

They feed each other in one direction. **MPI-504 (the sheet) comes first** — it is the
keystone artifact, and the swap family is what consumes a locked character. Building the
swaps against ad-hoc references means re-deriving the reference format the sheet is supposed
to define. MPI-504's `brief.md` already reads `../MPI-348/brief.md`.

- **MPI-504 — the sheet.** The layout that works as a VIDEO reference is the unknown, and
  the front body is HEADLESS: a production hack, not an oversight.
  `~/.claude/memory/domain/ai-video-asset-production.md` carries it along with "never run an
  image through a model twice", the 3/4 location plates and the empty camera-walk trick.
  Read it before designing the sheet. **The LoRA-training sheet is out of scope** — a
  different beast, and the card says so.
- **MPI-348 — the swap family. REJECTED 2026-09-14** (Fabio: Krea results very bad). Was face,
  head and character swap on `krea2edit`. Head Swap ships as a Flow on Klein 9B distilled
  (`comfy_workflows/flow_head_swap.json`, MPI-744) and is the working reference topology.

**The boundary that survives the merge:** proving a graph at the bench is not wiring a Flow.
A Flow outcome discovered here gets its OWN member card on this umbrella and goes through
`/mpi-add-flow` and its playbook — exactly as the LTX trio in phase 3 did after MPI-537
proved them at the bench. Do not wire an app Flow from inside MPI-348 or MPI-504.

Verification is bench-side, at the node graph: a sheet that holds identity across
regenerations, and a swap that keeps it. Memory
`tool_author_and_verify_a_comfy_workflow_offline` has the offline half — CLONE donor node
objects, and a `graphToPrompt` diff of 0 proves the graph without paying for a run.

## Phase 5: Flows v2 (MPI-259)

The deferred v1 paths — the Install button end to end, a flow whose required model is NOT
installed, flows declaring MULTIPLE required models, the reuse matrix. **This is why the
rip comes first:** those paths were written against the three flows phase 1 deletes, so
running them earlier means proving them on fixtures about to leave the repo.

Order inside the card is its own, but install-a-flow comes first — a badge and install
routing for a flow with a missing model is the path with the most unknowns, and multi-model
plus the reuse matrix sit on top of it. Overlay UI design pass and the 2nd flow follow.
New flows discovered along the way get their own cards on this umbrella — phase 4 is where
they come from.

## Phase 6: The 1.6 package format (MPI-532)

A folder dropped into `user_flows/` — restart and it appears. Manifest JSON + workflow JSON
+ optional images. No Python, no pip, no custom node repos.

The insight that makes it cheap: the op a Flow registers across four files
(`commandRegistry.js`, `universal_workflows.js`, `operationRegistry.js`,
`operation_registry.json`) is PURE DATA — `mediaInputs` is an array of
`{key, mediaType, title, required}`. So a user Flow's op is built from its manifest at load
time and no registry file is ever edited. Ids from `user_flows/` are namespaced `user:<id>`
against collision.

Scope: the loader; the manifest schema; a load-time validator; developer docs; a generated
node lockfile; and MPI republishing one of its own Flows as a package to prove the path.

Three things already settled — do not re-litigate:

- **The validator is developer experience, not security.** A scan of all 14 bundled node
  packs found no URL/HTTP/download classes, so a workflow JSON has no phone-home vector
  today — re-run that scan whenever a pack is adopted. It exists because the injector
  SILENTLY SKIPS an `Input_*` title with no matching node, so a broken flow otherwise fails
  as a mystery.
- **Do not fork or vendor the 14 node packs.** `js/data/modelConstants/nodesDeps.js` already
  pins every pack by repo + tag/commit — GENERATE a lockfile and installer from it. Same
  list feeds the validator allowlist.
- **Vocabulary:** "plugin" already means capability model here. Third-party packages are
  **Flows**. Never "flow plugins".

Deprecation UX depends on MPI-533's tombstone ledger: an installed Flow ALWAYS shows,
disabled, with the reason named. Silence reads as a broken app. The GitHub registry is
phase 7, not MPI-532 — advertising only, never a payment rail.

## Phase 7: Community submissions open at 2.0 (MPI-798, MPI-799)

**Fabio, 2026-09-17:** the day Cubric Studio 2.0 ships, a developer can build a Flow and
submit it to MPI for review. Two cards, both after MPI-532 (they need its format, linter and
docs):

- **MPI-798 — developer kit.** The generated node lockfile + installer from phase 6's second
  settled point, split out of MPI-532: the paid Flows never needed it (MPI's bench is kept in
  line by `/mpi-bump-local-comfy`), outside developers do.
- **MPI-799 — the registry.** A public GitHub repo: submission templates, CI running the
  package linter, public accept/decline decisions. Was "1.7+"; pulled forward to 2.0. Needs
  Fabio's repo name, licence and submission shape before it can be planned.

Not 2.0 release blockers unless Fabio says so; MPI-595 Gate A is unchanged.

## Phase 8: The Library is the shop window (MPI-831, MPI-841)

**Added 2026-09-20.** Phases 6 and 7 gave a developer a format, a linter, a dev kit and a
place to submit. They gave a USER nothing: `listFlows()` returns built-ins plus what is
already in `user_flows/`, and a grep for `cubric-flows-registry` across the app returns
zero hits. Nobody can find a third-party Flow without leaving the app.

Phase 6 always intended otherwise — *"The GitHub registry is phase 7 — advertising only,
never a payment rail."* Phase 7 built the submission half. **The advertising half fell
between MPI-532 and MPI-799 and was never carded.** Fabio went looking for that card on
2026-09-20 and there was none; this phase is it.

**Fabio, 2026-09-20:** they must show in the UI. A listing on the website is not an answer,
because most users never visit the website. They go in a **third-party section at the
bottom of the Flow Library**, labelled **Third-party Flows** — delivery, not authorship, so MPI's
own packaged Flows are not mislabelled as third-party.

- **MPI-831 — the section itself.** Third-party Flows at the bottom across all media types, a
  source flag on package tiles (the `TILE_FLAGS` system the Model Library already uses and
  the Flow Library passes nothing to), desaturated thumbs for anything uninstalled, and two
  hard-coded tiles for the paid Flows. Buildable today; only its paid tiles wait on the
  Gumroad URLs (MadPony-Identity MPI-81).
- **MPI-841 — the catalogue.** The same section lists what is NOT installed, read from the
  registry. Needs `index.json` generated in the registry repo first, then a cached fetch
  that never breaks the Library when it fails.

They ship independently and in that order. Both own `MpiFlowLibrary.js`, so they are
sequenced, never run as parallel workers.

## Verification

- Phase 1: app boots, Flow Library lists Head Swap only, no grep hit survives for the three
  removed ids.
- Phase 2: every 1.5 Flow passes the acceptance check above, port surface still one
  component or zero.
- Phase 3: per member, the `/mpi-add-flow` playbook's own gates (`docs/playbooks/add-flow/`).
  A real generation is the only proof that counts.
- Phase 4: bench-side only — a sheet that holds identity across regenerations, and a swap
  that keeps it. No app change is in scope for the phase itself.
- Phase 5: user-visible UX, needs the app.
- Phase 6: an MPI Flow republished as a data-only `user_flows/` package loads, validates and
  runs on a restart with no registry edit.
- Phase 7: a developer's ComfyUI set up by the installer passes the linter's node check;
  a test submission to the registry repo runs the linter in CI.
- Phase 8: with the network off the Library still opens; with it on, a real registry entry
  appears as a tile in Third-party Flows, and installing it REPLACES that tile rather than
  joining it.

Spin your own app (`npm run app:isolated`), never the user's `:3000`.

## Parallel Batch

Phases are ordered: 1 before 5 (fixtures), 2 before 3 (the `uiComponent` debt), 2 before 6
(the manifest schema is only knowable once `FlowDef` is final). Within phase 3, MPI-538 is
alone now. Within phase 6, loader / validator / docs split cleanly and could run as a batch.
Derive ownership from each member's `files.json` at dispatch time, not from this list.

**Phase 4 is not dispatchable and does not block anything here.** Both its members are
user-in-the-loop bench sessions at the node graph, owning no `js/` file, so they run beside
any other phase rather than in sequence with it. Inside the phase, MPI-504 precedes MPI-348
by construction. Do not hand phase 4 to a worker sub-agent.

## Plan Drift

**2026-09-20 — phase 8 added, and it is a GAP, not new scope.** Phase 6 promised the
registry would be "advertising only"; phase 7 built only the submission side. Nothing in
the app has ever read the registry, and no card covered it — Fabio went looking for one
and found none. MPI-831 and MPI-841 close it. The section is labelled **Third-party Flows**,
not "Third-party Flows", because Head Swap and DramaBox are Mad Pony Flows sold as
packages and the label names delivery rather than authorship.

**2026-09-19 — phase 7 is DONE; its text above is stale and is kept only as the record of
what was decided.** Both members shipped. MPI-798 (developer kit) closed on `37e7357c` +
`e6908dd6`. MPI-799 is live and public at
https://github.com/MadPonyInteractive/cubric-flows-registry — so "needs Fabio's repo name,
licence and submission shape before it can be planned" is no longer true: he answered all
four on 2026-09-19 and the repo was built, proven on a real runner and opened the same day.
The registry is MIT, a PR for both lanes, a catalogue and never a file host. **Read
`.agents/mpi-kanban/tasks/MPI-799/validation.md` before touching anything registry-shaped**
— in particular that its CI pin (`STUDIO_REF`) is `master` until 2.0 tags, because no
released tag carries `scripts/lint-flow-package.mjs`, and that CI cannot check node classes
or pack drift at all. **Phase 3 (lipsync, MPI-538) is now the only unfinished phase with an
actionable card.**

**2026-08-16 — merged.** MPI-529 and MPI-552 deleted into this card; their phase order,
drift notes and settled decisions are folded in above. No member card was closed or altered
in scope by the merge.

**2026-08-16 — second merge, MPI-530.** The character-consistency bench umbrella was deleted
into this card as phase 4 (members MPI-504, MPI-348); Flows v2 and community packages
renumbered 4→5 and 5→6. Fabio's call: one umbrella for everything Flow-related, after three
separate Flow umbrellas had already proven the split costly. The one fact the merge had to
carry rather than flatten is that phase 4 is bench work, not app wiring — recorded in the
phase and in the batch section above. MPI-530's own plan warned "do not grow this umbrella
into a Flow-wiring card"; that warning survives as the phase-4 boundary paragraph. No member
card was closed or altered in scope.
