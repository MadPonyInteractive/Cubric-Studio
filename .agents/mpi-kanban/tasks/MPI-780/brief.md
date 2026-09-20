# MPI-780 — Paid Flows for 2.0

**Gate:** MPI-595 Gate A. 2.0 does not ship until this card is done or explicitly dropped.

## Decided (Fabio, 2026-09-16)

- **Two existing Flows become paid:** `head-swap` and `drama-box`. They are the Flows aimed
  at users taking work furthest: a head swap and a directed voice performance. Plain
  text-to-speech stays free through `chatter-box`.
- **`stems` stays free** (Fabio, later the same day). Demucs v4 was tried on a Hugging Face
  Space and showed no clear gain over the shipped v3, so no upgrade and no card. Revisit
  only if a clearly better separator appears.
- **Mad Pony Interactive sells them, each as its own Gumroad product.** One-time purchase.
  The price is set per Flow, by how much work went into it (most around $5). A bundle may
  come later and is out of scope here.
- **The first 100 buyers of each Flow get it free.** It is counted per Flow: the first 100
  on Head Swap are not the first 100 on DramaBox, and it does not carry over to Flows released
  later.
- **Nobody loses a free Flow.** The Flow Library was dev-gated through v1.5.0, so neither
  of these two has ever reached a released user.
- **The product is the workflow.** Listings never talk about commercial use. Every listing
  carries the spec block below. Licence stance and its fallback:
  `.agents/mpi-kanban/private/paid-flows-licence-stance.md` (gitignored).
- **The app is Cubric Studio from 2.0** (MPI-708), so listings name Cubric Studio.

### Listing spec block (approved wording, fill the brackets per Flow)

> **What you are buying:** a Flow, a ready-made workflow for Cubric Studio. It contains no AI models.
>
> **Models:** the first time you install this Flow, Cubric Studio downloads the models it needs. Each model has its own licence, set by its publisher, and the app shows it before the download starts. That licence is between you and the publisher. Please read it and use the model within its terms.
>
> **Requires:** Cubric Studio 2.0 or later · [GPU / VRAM] · internet connection to install
>
> **Includes:** the Flow folder to add to Cubric Studio · updates to this Flow

## Unlock mechanism: B, a package download (Fabio, 2026-09-16)

- **The two Flows leave the app.** Each is sold as a `user_flows/` package (manifest JSON +
  workflow JSON + images, no code), delivered by Gumroad as the product file. No in-app key,
  no R2, no server. A buyer can share the folder; Fabio accepts that. The code is not in the
  app, so nobody gets it without buying (the public repo's git history excepted, accepted).
- **Why not A (key at install):** without a machine-ID binding a key installs without limit,
  and a counted-activation key breaks every time a release forces a reinstall, which has
  happened before.
- **This is what MPI-532 always intended:** Cubric never sells anything, MPI sells its own
  Flows like any third party, authored in their OWN repo under their own licence, never in
  the AGPL app repo. No MPI-532 text needs reversing.
- **Consequence: MPI-532 moves from "targets 1.6" to "blocks 2.0".**

## Requirements the package route must meet

- **Packages survive app updates.** `user_flows/` must live OUTSIDE the tree an update
  replaces (with user data, not in the app folder), because releases have forced full
  reinstalls before. The 2.0 rename moves the userData folder (MPI-595, MPI-708), so
  `user_flows/` has to move with it.
- **Head Swap's boxes are JS.** `js/services/workflowInjectors/headSwapInjector.js` is keyed
  to the built-in op `flowHeadSwap` (`commandRegistry.js:1029`: "headSwapInjector is the only
  path a box takes"). A package op is built from its manifest and namespaced `user:<id>`, so
  the manifest needs a way to NAME that injector as an app capability, or the packaged Head
  Swap loses its boxes. Resolve in MPI-532's manifest schema.
- **Deps stay in the app.** A manifest may only reference `requiredModels`/`requiredDeps` ids
  the app already declares (MPI-532 validator rule). So `klein-9b-lora-headswap`,
  `comfyui-inpaint-cropandstitch`, the `dramabox-*` deps and the `ComfyUI-MelodramaBox` node
  pin stay in the app's registries when the FlowDefs leave. Deleting a dep entry strands
  weights (CLAUDE.md router, "Removing a model").
- **The licence gate still fires.** Klein 9B's gate is keyed on the model id, so it works for
  a package Flow unchanged. Check it on the first packaged run.

## Open, needs Fabio (not blocking phase 1)

1. ~~**Discovery.**~~ **ANSWERED yes, Fabio 2026-09-19.** The Flow Library shows the two paid
   Flows as link tiles, because Gumroad is the only place a download is ever counted (the app
   has no telemetry). Hard-coded, not registry-fed. Built by **MPI-831**, which also adds the
   "Third-party Flows" section, a source badge and dimmed uninstalled tiles. The Get-it button
   opens a `cubric.studio` redirect, never the coded Gumroad URL baked into a public repo.
2. ~~**Install UX.**~~ **ANSWERED by MPI-532 as built.** The Flow Library is already a drop
   target for a package folder or its zip, staged and validated before it lands. No "Add a
   Flow" button is needed. See `docs/flow-packages.md` § Install, refresh, remove.

## Copy to change

- `docs/releases/UNRELEASED.md` (its Flow list names every Flow as part of the app), each
  Flow's description, the docs site, the website.

## Fabio only

- Create the two Gumroad products (the package folder as the product file), each with a
  100-use 100%-off code.
- Terms and a refund policy for the products.
- Per-Flow VRAM numbers for the spec block (never measured by this card).
