# MPI-849 — Paid cloud models through the user's own DeepInfra key

**Umbrella.** Six members. Decision taken by Fabio 2026-09-20 after a costed review of all
three options in `docs/proprietary-models-research/`: **Option A, bring your own key.** No
credit system, no markup, no proxy, no company, no lawyer. The user pastes nothing new — the
app already holds their DeepInfra key for the prompt enhancer. They pay DeepInfra directly and
hold that contract themselves.

**Local ComfyUI models stay exactly as they are, and stay free.** Nothing in this umbrella
touches a local generation path except by adding a branch beside it.

**Verify mode:** `user-ux` overall. Per phase below — MPI-850 is `auto`, every other member is
`user-ux`.

## Members

| Card | What it is | Phase |
|---|---|---|
| MPI-850 | The price module: two measured formulas + a generated price snapshot. Pure arithmetic, no app, no UI | 1 |
| MPI-851 | The cloud executor: `provider` on the ModelDef, the one-line seam, a third queue lane, the install gates | 1 |
| MPI-852 | The live price tag in the prompt box, recomputing as references and settings change | 2 |
| MPI-853 | The **Paid models** section at the foot of the Model Library | 2 |
| MPI-854 | The agent states a price and dispatches only after OK — plus the server-side gate | 2 |
| MPI-855 | The spend readout in the Remote panel — this month, and what is left | 2 |

## Current State

Project mode: **scalable-foundation**. Full guardrails, no prototype shortcuts.

**The research is done and measured, not estimated.** `docs/proprietary-models-research/01d-deepinfra-image-video.md`
carries real API calls costing $0.68 total: per-model prices decomposed to the cent, the exact
Seedance token formula from an ffprobe of a real clip, which tier censors this product's
content, and the ~1 MP ceiling. `research/findings.md` in this card carries the four code
investigations behind the six members, every claim re-verified by hand.

**What already exists and is reused, not rebuilt:**

- The **key**. `resolveConnection(profileId, ask)` over `secrets:get-endpoint-profile-request`
  (`routes/llm.js:113-117`). Encrypted at rest, env fallback, URL-bound, no get channel. Three
  lines, no renderer change, no new secret.
- The **confirm**. `agent:confirm` → `POST /agent/confirm` ships today for installs; `kind` is
  not an enum and simply needs reading.
- The **sidecar**. `generationSettings` passes through `save-generation` verbatim, so a cost
  field survives disk and reload with zero server edits.
- The **executor contract**. `generationService.js:942-1647` — save, sidecar, gallery card,
  terminals — is already written against a generic `exec` object with no ComfyUI assumption.

**What does not exist:** any `provider`/`runtime` discriminator on a ModelDef; any cost or
spend ledger anywhere (`grep` for `payment|balance|spend|estimatedCost` returns nothing); any
consumer of `hasDeepInfraKey` on the generation path; a third queue lane.

**The shape of the risk.** The install machinery does not need teaching to *pass* for a
weightless model — it passes already, twice, by accident (`[].every() === true`, and a dep
loop that never runs). It needs teaching to ask a **different question**: *is a key saved?*
That inversion is the single idea holding all six members together.

## Completed

- [ ] Nothing yet.

## Remaining Work

## Parallel Batch: Phase 1 — the two halves that share nothing

Genuinely disjoint: MPI-850 creates only new files and needs no app; MPI-851 never reads a
price, because a real dispatch gets its true cost back from DeepInfra in
`inference_status.cost`. Estimating and spending are separate concerns and stay separate.

- [ ] **MPI-850** — the price module and the generated snapshot. Ownership:
  `js/data/modelConstants/deepinfraPricing.js` (new), `scripts/sync-deepinfra-prices.mjs`
  (new), `dev_configs/deepinfra-prices.json` (new), `tests/deepinfra-pricing.test.cjs` (new).
  Briefings: `dos_and_donts.md`. **Verify:** `node --test "tests/deepinfra-pricing.test.cjs"`
  green, asserting every measured figure in `01d` § 2b/2c/3 to the cent — FLUX schnell at four
  sizes, a 1 K Nano Banana edit on all three tiers, and the 480p Seedance clip at exactly
  40,594 tokens. Negative controls: an unknown model id and a `time`-priced model both refuse
  rather than guess. **Verify mode:** `auto`.
- [ ] **MPI-851** — the cloud executor, the ModelDef discriminator and the install gates.
  Ownership: `js/services/generationService.js`, `js/services/cloudExecutor.js` (new),
  `js/services/generationStore.js`, `js/data/modelConstants/models.js`,
  `js/data/modelConstants/resolveModelDeps.js`, `js/data/modelRegistry.js`, `routes/comfy.js`,
  `routes/deepinfra.js` (new), `routes/projects.js`, `tests/lane-agreement.test.cjs`,
  `tests/resolve-model-deps.test.cjs`. Briefings: `comfy_engine.md`, `state.md`, `events.md`,
  `root-cause.md`. **Verify:** one real FLUX-1-schnell generation ($0.0005) lands a gallery
  card with history and a sidecar carrying its cost; `npm test` green including the two tests
  this card deliberately changes; with the key cleared the same dispatch bails through
  `_failBail` with actionable copy and the lane settles. **Verify mode:** `user-ux`.

## Parallel Batch: Phase 2 — four surfaces, disjoint ownership

Each depends on phase 1 and on nothing in this batch.

- [ ] **MPI-852** — the live price tag in the prompt box. Ownership:
  `js/components/Organisms/MpiPromptBox/` (all files). Briefings: `components.md`,
  `dos_and_donts.md`, `component-events.md`, `state.md`. **Verify:** in the running app the
  estimate appears only for a paid model, matches `01d`'s measured figure for that
  configuration, updates when a reference image is added or removed and when ratio, tier or
  duration changes, survives an op switch (the remount path that fires no event), and hides
  when Run-locally is on. **It multiplies by the batch count** — a batch of 4 on Nano Banana
  Pro reads about $0.54, not $0.13. **Verify mode:** `user-ux`.
- [ ] **MPI-853** — the Paid models section. Ownership:
  `js/components/Organisms/MpiModelManager/` (all files),
  `js/components/Primitives/MpiTileSheet/MpiTileSheet.css`, `js/shell.js`,
  `js/shell/heroStats.js`. Briefings: `components.md`, `dos_and_donts.md`. **Verify:** the
  section renders at the foot with a price per tile and no Download control; the hero count is
  unchanged by adding a paid model; the section still renders on a search matching no local
  model; the chip repaints when a key is saved without reopening the library; `npm test` green
  (the orphan sweep and dep audit untouched). **Verify mode:** `user-ux`.
- [ ] **MPI-854** — the agent states a price, and the gate that cannot be talked around.
  Ownership: `services/agentLoop.mjs`, `js/components/Compounds/MpiAgentChat/` (all files),
  `routes/connector.js`, `routes/agent.js`, `js/events.js`. Briefings: `events.md`,
  `components.md`, `root-cause.md`. **Verify:** the agent asking for a paid generation raises a
  card showing the estimate and spends nothing until Yes; **a batch raises ONE card carrying
  the batch total and the count, not one card per generation** (batch size 4); No records a
  decline that does not say "installation"; a reload mid-confirm repaints the card **with**
  its price; a direct
  `POST /connector/generate` for a paid model without consent is refused with a coded error;
  `npm test` green including `tests/agent-no-delete.test.cjs`. **Verify mode:** `user-ux`.
- [ ] **MPI-855** — the spend readout. Ownership:
  `js/components/Organisms/MpiLlmSettings/` (all files), `routes/deepinfraAccount.js` (new),
  `services/spendLedger.mjs` (new). Briefings: `components.md`, `dos_and_donts.md`,
  `component-events-primitives.md`. **Verify:** the readout shows this month's spend and the
  remaining balance after a click, hides for a non-DeepInfra profile, and reads `NO_KEY`
  cleanly with no key. **Security, and this one is not optional:** a test asserts the route's
  response contains no `line1`, no `postal_code`, no `last4` and no `name`, and that nothing
  reaching `logger.*` carries the upstream body. **Verify mode:** `user-ux`.

## The models — Fabio's list, 2026-09-20

All fifteen ids verified live on `/models/list` the day the list was given. Prices are
per-image, or per second of video, at the listed rate.

| Model | DeepInfra id | Price | Pricing |
|---|---|---|---|
| Seedream 4 | `ByteDance/Seedream-4` | $0.04 | structured |
| Seedream 4.5 | `ByteDance/Seedream-4.5` | $0.04 | structured |
| Seedream 5.0 Pro | `ByteDance/Seedream-5.0-Pro` | $0.0495 to 1.5K, $0.099 above, +$0.0033/extra input image | structured + prose tiers |
| FLUX 2 Dev | `black-forest-labs/FLUX-2-dev` | $0.01 at 1 MP / 28 steps, **scales with area and steps** | structured |
| FLUX 2 Pro | `black-forest-labs/FLUX-2-pro` | $0.015 flat | structured |
| FLUX 2 Max | `black-forest-labs/FLUX-2-max` | $0.10 flat | structured |
| Nano Banana 2 Lite | `google/nano-banana-2-lite` | $0.034 (1 K only) | **constant** |
| Nano Banana 2 | `google/nano-banana-2` | $0.067 at 1 K | **constant** |
| Nano Banana Pro | `google/nano-banana-pro` | $0.134 at 1 K/2 K, $0.24 at 4 K | **constant** |
| Gemini 3 Pro Image | `google/gemini-3-pro-image` | identical to Nano Banana Pro | **constant** |
| Seedance 1.5 Pro | `ByteDance/Seedance-1.5-Pro` | $1.20/M tok → **$0.30** per 5 s 1080p | **constant** (measured) |
| Seedance 2.0 | `ByteDance/Seedance-2.0` | $7.70/M tok plain → **$2.07** per 5 s 1080p | **constant** (measured) |
| Wan 3.0 | `Wan-AI/Wan3.0-Video` | $0.05 / $0.10 / $0.20 per s by tier → **$1.00** per 5 s 1080p | structured |
| Veo 3.1 Fast | `google/veo-3.1-fast` | $0.15/s → **$1.20** per clip | structured |
| Veo 3.1 | `google/veo-3.1` | $0.40/s → **$3.20** per clip | structured |

**Nine of the fifteen price themselves** from structured fields. Six need the measured
constants MPI-850 owns: the four Gemini-family ids and both Seedance models.

Three things this list forces, none of them obvious:

- **`gemini-3-pro-image` and `nano-banana-pro` are the same model under two ids** — byte-identical
  pricing and input fields, and the Gemini card's own description calls itself Nano Banana Pro.
  Shipping both gives the user two tiles for one thing. Ship one and alias the other, or label
  the pair explicitly.
- **Veo has no `duration` field at all** — fixed-length clips, so its per-second rate must be
  multiplied by a hand-held duration constant even though its rate is structured. It also
  carries `sample_count` (a native batch) and a `person_generation` gate
  (`allow_adult` | `dont_allow`) that no other model in the list has.
- **`nano-banana-2` is on the list despite refusing this product's content twice** while both
  its cheaper and its dearer sibling accepted the identical request (`01d` § 3). Fabio's call,
  and fine — but its HTTP 500 is a *frequent* path for this audience, not an edge case, so it
  needs a named, non-alarming failure message rather than a generic error. Failed calls are
  not billed.

## Decisions

**Settled by Fabio, 2026-09-20:**

1. **Batch pricing for the agent** — a batch gets ONE confirm showing the batch price, not one
   per generation. **Batch size 4**, the SDXL shape. Capacity is not a constraint: DeepInfra
   allows 200 concurrent requests per model.
2. **Spend history** — an append-only ledger in userData as the panel's source, plus the cost
   in the sidecar because one is written anyway.

3. **One key, the one that already exists.** Paid generation uses the **same** DeepInfra key
   the prompt enhancer and the agent already use. **No second key, no new settings field, no
   new onboarding.** Presence check is `hasEndpointKey('deepinfra')`
   (`main/secretsStore.js:280`); keys are stored **per profile** and persist, so the check
   answers correctly even while another provider is the active LLM connection. If a user has
   the key they get the models; if not, they do not, and nothing else changes for them.
   *One edge to handle:* the main process **nulls the key when the profile's bound base URL no
   longer matches** (`:418-427`), so a user who repointed the DeepInfra profile at a custom
   host reads as keyless. Treat that as "no key", not as an error.
4. **The no-engine gate stays exactly as it is for this umbrella.** Fabio 2026-09-20: opening
   the app without ComfyUI is a big thing, because everything ComfyUI-dependent would then
   have to toast instead of run. Confirmed by the code — `blockedByNoEngine()` guards **six**
   call sites, and two of them are **creating a project** (`js/shell/projectUI.js:261`) and
   **opening a project** (`:557`), not merely the two libraries (`js/shell.js:486`, `:501`).
   So without ComfyUI a user cannot reach a project at all.
   **Carved out to its own card, MPI-856** — it is the door to the cloud-only user and a
   prerequisite for nothing in this umbrella. MPI-849 ships paid models to users who already
   have ComfyUI; the gate is untouched.

**Still open:**

5. **Edit ops have no pixel dimensions.** *Answering Fabio's question directly: yes, it is the
   OUTPUT we do not know.* On an edit op the output inherits the **source image's** size, so
   the app deliberately hides the ratio picker (`modelShowsRatio` returns false when the op is
   in `model.imageSizedOps`) and nothing in the settings says how big the result will be.
   **But the problem is far smaller than it first looked.** Across the fifteen agreed models:
   - **Nano Banana (all four ids): no dimensions needed at all.** They bill a *fixed token
     count per resolution tier* — 1120 tokens for 1 K — not per actual pixel, and they never
     return more than ~1 MP anyway. An edit is a flat $0.034 / $0.067 / $0.134.
   - **Seedream 4 and 4.5, FLUX 2 Pro and Max: flat per image.** No dimensions needed.
   - **Video (Seedance, Wan, Veo): needs a resolution *tier* and a duration**, both of which
     the controls do carry.
   - **Only two cases actually need real pixels:** **FLUX 2 Dev**, the one image model that
     scales with area and steps, and **Seedream 5.0 Pro**, which changes price at a 1.5 K
     threshold.

   And for those two the dimensions are available: staged media already carry
   `pixelDimensions` (`MpiPromptBox.js:583`, from the upload record). *Recommendation: read
   the source image's own dimensions for those two models; for every other model price flat or
   by tier and ignore the question. Never render `$0.00`, which reads as "free".*

## Plan Drift

- None yet.

## Verification

**Verify mode:** `user-ux`.

End to end, in the user's own app, with their own key:

1. A user with no DeepInfra key sees paid models, sees what they cost, and is told plainly
   where the key goes. Nothing offers to download them; nothing pretends they are installed.
2. With a key saved, selecting a paid model shows an estimate in the prompt box that matches
   `01d`'s measured figures, and that moves when the inputs move.
3. Generating lands a real gallery card with history and a sidecar carrying the true cost from
   `inference_status.cost` — not the estimate.
4. The Remote panel shows what was spent this month and what remains, and no test can find a
   billing address, a postcode or a card last4 anywhere in a response body or a log line.
5. The agent never spends without an explicit OK, on any dispatch path including the CLI.
6. Every local generation path behaves exactly as it did before.

## Preservation Notes

- `research/findings.md` holds the whole code investigation with `file:line` evidence. Read it
  before any member; it is far cheaper than re-deriving.
- **Docs that go stale:** `docs/generation-lifecycle.md` (the cloud executor, the third lane),
  `docs/llm.md:155-160`, `docs/agent-chat.md:45,67,155`, `docs/model-library.md`,
  `js/events.js:134`, `js/components/types.js:1060-1075`. Rule files
  (`.claude/rules/component-mounts.md:234-235,350`,
  `.claude/rules/component-events-primitives.md:215-221,358`) need **Fabio's explicit
  permission** before any edit — CLAUDE.md cardinal rule 5.
- **Prices drift monthly.** `dev_configs/deepinfra-prices.json` carries a checked-on date and
  is regenerated by a script, never hand-edited. A stale snapshot quotes the wrong number at a
  user, which is worse than quoting none.
- **Three measured unknowns are carried as risks, not blockers:** nothing above ~1 MP is
  reachable on Nano Banana; the 720p and 1080p video pixel dimensions are assumed, not
  measured; the audio surcharge on video is unmeasured. Each costs one small call to settle
  when its member is picked up.
- `nano-banana-2` is deliberately **excluded** from the shortlist: its filter rejected this
  product's content twice while both its cheaper and its dearer sibling accepted the identical
  request.
