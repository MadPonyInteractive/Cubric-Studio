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

- [ ] `cloudRunFields()` exported from `cloudExecutor.js`, and its own POST body built
      from it — so the priced run and the dispatched run cannot drift
- [ ] `estimateRunCost()` prices what `buildSizeFields()` will actually SEND, not what the
      user picked: a clamped size is what gets billed
- [ ] Refuses (returns null) for a local model, and for any shape `estimateCost` refuses

## 2 — the tag

- [ ] A new `__col--price` column immediately before `#bottom-right-slot`, never inside it
- [ ] `grid-template-columns` widened from 7 tracks to 8
- [ ] Recomputed in `_refreshOpSlot()` — the convergence point that rebuilds every control
- [ ] Recomputed in `_emitMediaChange()` — every reference add, remove, reorder, prune
- [ ] Recomputed on `settings:shared:update`, `settings:model:update`, `ratio:*`,
      `state:changed` on `s_selectedModelIdByType`
- [ ] Hidden for a local model; never renders `$0.00`
- [ ] Reads `el.getRunPayload()`, never `state.currentProject` (~300 ms write debounce)

## 3 — the wording

- [ ] `estimateCost().display` VERBATIM — it carries its own "about" and its own sub-cent
      form; a batch figure never comes from multiplying the string
- [ ] No "don't ask again" affordance of any kind (Fabio, 2026-09-21, via MPI-876)

## Verification

- [ ] `tests/cloud-price-tag.test.cjs` green, and proven RED before the fix
- [ ] `npm test` green
- [ ] `npm run lint:components` green
- [ ] Fabio, in the running app: the tag appears only for a paid model, moves on ratio /
      tier / duration / batch, survives an op switch, and is gone on a local model
