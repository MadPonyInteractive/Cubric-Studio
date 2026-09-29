# MPI-972 - 2.0 copy the docs contradict

Six user-facing strings (card description) plus the internal notes. Copy-only; no behaviour change.

## Fixes

1. `models.js` Klein 4B description: drop "prompt left empty" and "the only one" (Klein 9B, Krea 2 and the SDXL family also inpaint). Removal needs an instruction naming the target (commandRegistry inpaint help).
2. `agentLoop.mjs` system prompt: Cubric Vision -> Cubric Studio.
3. `MpiNewProject.js` hint: name no folder. The default is Documents/Cubric Vision OR Cubric Studio depending on app major AND disk state (`routes/shared.js` `_getDocumentsFolder`), so any fixed name is wrong for someone. Drop the version-flip comment with it.
4. `hotkeyRegistry.js` radial description: Gallery, Models, Flows, latest workspace.
5. "Settings -> Remote -> Language Models": Remote is its own panel. Swept EVERY call site, not only the two the card names: `cloudExecutor.js` x2, `MpiModelManager.js` x2, `llmService.js`, `agentLoop.mjs` x3, `routes/llm.js` x2, plus the test that asserts the llmService string.
6. `MpiVideoControlBar.js` tooltip: drop "(F)" (no key toggles player fullscreen; binding one is a feature, not a fix).

Internal: add-flow README + flowsRegistry header "dev-gated" (lifted MPI-589); generationService TWO-LANE -> three lanes (MPI-851).

Out of scope, owed at the 2.0 cut: which 1.x versions update in place (MPI-708 D1).

## Verification

**Verify mode:** auto

- grep for every old phrasing returns nothing in js/ services/ routes/ tests/.
- `node --test tests/llm-service.test.cjs` passes.
- `node --check` on each edited .mjs/.js that node can parse.

## Current State

All six fixed and pushed in fdb8bedf8; docs session messaged (Docs repo state/messages/94f68bc9). Closes on a green CI run of fdb8bedf8.
