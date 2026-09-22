# MPI-852 — checklist

## 0 — what the brief got wrong, re-measured against the shipped code

The brief predates MPI-851/853/875 landing. Four of its premises are now false, and
building to them would ship bugs:

- [x] **"Hide or zero when `state.engineOverride === 'local'`"** — WRONG, and it would
      hide a real charge. `generationService.js:96` routes on `model.provider` BEFORE
      `forceLocal` is read, and `:961` forces `forceLocal: false` for any cloud model. The
      Run-locally toggle cannot divert a cloud run, so hiding the price there would quote
      nothing for a generation that still bills.
- [x] **"A batch of 4 on Nano Banana Pro reads about $0.54"** — unreachable. Of the fifteen
      cloud models only three declare a batch at all (`flux-schnell-cloud`,
      `veo-31-cloud`, `veo-31-fast-cloud`); the other twelve carry
      `capabilities: { batch: false }`, so `modelShowsBatch` never mounts the control.
      The multiply still has to be right — it is just verified on a different model.
- [x] **"The formula's steps term has no live input"** — it has no input at all, which is
      simpler. `buildSizeFields` never emits a steps field and every cloud `body` is `{}`,
      so the provider always runs its own `default_iterations` and the steps term is
      exactly 1.0. Omit `steps` rather than sourcing it.
- [x] **"Moves when a reference is added or removed"** — only across 0 -> 1.
      `cloudExecutor._firstImagePath` sends ONE image, so a second or third staged
      reference changes no field in the body and cannot change the bill.
- [x] **Grid tracks: 7, not 8, and there is no agent-mode grid.** `MpiPromptBox.css:4`
      declares 7; the `--agent-mode` 5-track block the brief names was deleted by MPI-797
      Phase 3. One declaration to widen, not two.

## 1 — one derivation, two consumers

- [x] `cloudRunFields()` exported from `cloudExecutor.js`, and its own POST body built
      from it — so the priced run and the dispatched run cannot drift
- [x] `estimateRunCost()` prices what `buildSizeFields()` will actually SEND, not what the
      user picked: a clamped size is what gets billed
- [x] Refuses (returns null) for a local model, and for any shape `estimateCost` refuses

## 2 — the tag

- [x] ~~A new `__col--price` column immediately before `#bottom-right-slot`~~ **REVERSED
      by placement A1** — the price is a span INSIDE the Cue button, created in
      `_renderRunCluster` (the one place the `innerHTML` clear cannot eat it) and refilled
      at the end of that same function
- [x] ~~`grid-template-columns` widened from 7 tracks to 8~~ **back to 7** — the column
      it was widened for no longer exists; a track with no column leaves a dead gap
- [x] Recomputed in `_refreshOpSlot()` — the convergence point that rebuilds every control
- [x] Recomputed in `_emitMediaChange()` — every reference add, remove, reorder, prune
- [x] Recomputed on `settings:shared:update`, `settings:model:update`, `ratio:*`,
      `state:changed` on `s_selectedModelIdByType`
- [x] Hidden for a local model; never renders `$0.00` — `hide` on the span, not an empty
      string, or its separator rule hangs beside CUE with nothing after it
- [x] Reads `el.getRunPayload()`, never `state.currentProject` (~300 ms write debounce)

## 3 — the wording

- [x] `estimateCost().display` VERBATIM — it carries its own "about" and its own sub-cent
      form; a batch figure never comes from multiplying the string
- [x] No "don't ask again" affordance of any kind (Fabio, 2026-09-21, via MPI-876)

## Verification

- [x] `tests/cloud-price-tag.test.cjs` green (13/13), and proven RED before the fix —
      the A1 rewrite re-proved assertion by assertion against HEAD's blobs, including a
      mixed tree (new 7-column JS + old 8-track CSS) failing on `8 !== 7`
- [x] `npm test` green at the seam: 159 tests across every MpiPromptBox-referencing
      file, 0 fail (1 pre-existing todo)
- [x] `npm run lint:components` green
- [ ] Fabio, in the running app: the tag appears only for a paid model, moves on ratio /
      tier / duration / batch, survives an op switch, and is gone on a local model
