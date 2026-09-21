# MPI-877 — checklist

Started 2026-09-21 on Fabio's word. He settled the card's one open question in the same
breath: **`control` does NOT respect masks.** So step 4's `control` half is answered by
the owner of the model, not by a trace — record it and keep it out of the mask docs.

## 1. Attach the mask (plumbing)

- [x] ~~`js/shell/navigation.js` exports the mounted block~~ — **tried and backed out.**
      It reaches the viewer without a DOM query, but it drags the whole component tree into
      agentDispatch's CJS require, and `MpiLevelMeter.js:2` imports a server-absolute
      `/js/utils/dom.js` Node cannot resolve. Every dispatch test died on an audio module.
- [x] `js/shell/activeMask.js` instead — a one-slot, import-free reader. The workspace that
      owns a mask publishes; dispatch asks.
- [x] `MpiGroupHistoryBlock` publishes that reader in `setup` and withdraws it in `destroy`,
      reading exactly as its own `run` handler does (`viewer.el.hasMask?.()` →
      `viewer.el.getCurrentMaskDataURL?.()`, MpiGroupHistoryBlock.js:1828).
- [x] `agentDispatch._submitGeneration` puts `maskDataUrl` on the dispatch config.
      `config.maskDataUrl` is already the contract — `generationService.js:849` destructures
      it and `commandExecutor.js:791` injects it as `Input_Mask`. Nothing downstream changes.

## 2. Make the refusal conditional

- [x] `agentDispatch.js:252` refuses a `requiresMask` op only when no mask exists.
- [x] The refusal message tells the agent to ask the user to paint one, instead of
      claiming the endpoint cannot supply it.

## 3. Teach it

- [x] `docs/agent/masking.md` — one new `app:masking` corpus entry (`agentCorpus.mjs`
      `appEntries()` derives the id from the filename). The whole localised-edit model:
      what a mask does, edit vs inpaint vs detail, delta-only prompting, images and GIFs
      only, and which ops honour it.
- [x] A Masking rule in the `agentLoop.mjs` system prompt, in the shape of the existing
      Settings / Guide rules, pointing at `read_knowledge "app:masking"`.
- [x] The "Honest limits" line stops reading as "masks are out of reach": the agent still
      cannot PAINT one, and can now USE one.
- [x] Correct every model guide that teaches the opposite — `flux-2.md:36-39`,
      `krea-2.md:25-26`, `chroma.md:32`, `illustrious.md:31`, `pony.md:23-25,37-39`,
      `sdxl.md:28-30,48-50`.

## 4. Settle the ops before they reach the docs

- [x] `i2i` — honours a mask. Traced in `klein_9b_t2i.json`: node 592 gates the shared
      encode (plan.md has the table).
- [x] `control` — does **NOT** honour a mask. Fabio, 2026-09-21.
- [x] The GIF surface — confirm rather than assume. Read only: `routes/gifCutout.js` and
      `docs/masking-sam3-gif.md` belong to MPI-858's live claim, so they are traced, never
      edited, from here.

## 5. Verify

- [x] `tests/agent-mask-dispatch.test.cjs` — a mask present reaches the executor payload,
      no mask omits it, `inpaint` with a mask dispatches, `inpaint` without one refuses,
      and the refusal names painting.
- [x] `npm test` clean.
- [ ] **user-ux:** Fabio re-runs the original ask — the boy's reflection alone turns
      demonic, under a normal boy. That judgement is his, not an agent's.
