# MPI-1286 validation: Storyboard run by Cosmo and by an outside agent

2026-10-27, my own Electron instance (own port 54793, profile, APP_DOCUMENTS; engine 48188 shared,
under the GPU lease, Fabio's yes in the turn). DeepInfra key seeded in that profile, deleted after.
Rig: `scratchpad/sb1286/run.cjs` (not committed).

## Run 1: Cosmo asked in words: PASS

"Make me a storyboard of a lighthouse keeper who finds a message in a bottle and rows out to a tiny
island. Three panels, 16:9, 1K, Turbo on."

- Cosmo (DeepInfra default model): `list_models` -> `list_cards` -> `read_knowledge app:flows` ->
  `describe_model storyboard` -> `generate {flowId:'storyboard', fields:{positive, panelCount:3, ratio, qualityTier, turbo}}`,
  everything in fields, no plan sent. Said it had started, then saved the brief to project memory.
- App planned on Cosmo's model (`flow-enhance` Storyboard on MiMo-V2.6-Flash, 46 s), drew 3 cast
  pictures (Cast stack), then 3 panels as Klein edits in ONE stack in story order, then the numbered
  sheet. The same keeper in all three panels; each panel's card note is its Intent line.
- Chat spend $0.0038 for the turn.

First attempt ended "no pictures" on the message: Cosmo read it as "don't draw" and only wrote a
memory note ($0.0033). My wording, not a defect: a user means "no pictures attached" rarely enough,
and Cosmo did see Storyboard in `list_models`.

## Run 2: MCP shape, `/connector/generate` with no plan: PASS

`POST /connector/generate {flowId:'storyboard', folderPath, cardName, fields:{positive:'A waitress in a late-night diner meets a stranger who knows her name.', panelCount:3, ratio:'16:9', qualityTier:'1k', turbo:true}}`

- One held answer after 197 s: `ok:true`, `stackId`, `cards` = panels 1-3 `{panel, groupId, itemId, filePath}`
  (edit_004..006), `sheet:true`, `plan` (CAST Mara / Stranger, PLACES Ruby's Diner, 3 PANELs).
- Status bar: "drawing Mara, Stranger, Ruby's Diner first ...", "6 generations finished",
  "... is ready: 3 panels in the stack, and a numbered sheet."

Rig traps hit on the way (not app defects):
- A `folderPath` the connector does not list answers `PROJECT_NOT_FOUND`: create the project by name
  under APP_DOCUMENTS and take the listed path.
- Node `fetch` drops a held `/connector/generate` at 300 s (`UND_ERR_HEADERS_TIMEOUT`); my harness
  then closed the app mid-run. Use `node:http`. The next boot reported that interrupted run's
  undrawn panels as "3 of 3 did not finish" (a visible end, as it should be).

## Noticed

- A 3-panel sheet is a 2x2 grid with one black cell (cosmetic).

Spend: about $0.01 DeepInfra (Cosmo turns $0.0071 measured, three planner calls on MiMo-V2.6-Flash).
GPU: ~13 Klein Turbo 1K images on the local 4060 Ti, ~10 min across three launches.
