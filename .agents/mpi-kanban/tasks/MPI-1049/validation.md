# MPI-1049 Validation

## Built (2026-10-10, session 38894ae1)

- No Background toggle (`transparentBackground`, eraser icon, perModel, default off) on t2i and
  edit, shown only for a model with `transparentPrompt` (Qwen-Image 2.1).
- It injects `Transparent_Background`; `commandExecutor._buildParams` wraps `Input_Positive` in
  the vendor sentences (`withTransparentPrompt`, idempotent) and drops the key. The sidecar
  keeps the user's words; Reuse restores the toggle (`promptReuse.js`).
- Enhance is told ("Transparent background: ... NO background") via `withTransparentBackground`.
- Agents: named param `transparent` (connector, MCP, in-app agent, routines), error
  `INVALID_TRANSPARENT`; Qwen 2.1 guide + modelPriority notes route a no-background ask with no
  model named to Qwen 2.1, or offer it beside another model + removeBackground (Fabio's ask).

## Evidence

- `node --test tests/transparent-background.test.cjs`: 7 pass (resolver, offer, refusals,
  idempotent wrap, control visibility, sidecar reconcile, Enhance line).
- `npm test`: 3019 pass, 0 fail, 2 skipped. ESLint clean on every changed file.
- Agent tool schema budget raised 18,966 -> 19,084 (+118), annotated.

## Fabio's eye-test (2026-10-10, his app, local engine)

- t2i_019: toggle on, but an Enhance written BEFORE the toggle existed (400 words of beach):
  RGBA out, 1.9% clear. The sentences arrived (engine history); the prompt described a setting.
- Fixed: the No Background rule moved into the enhancer's SYSTEM prompt
  (`TRANSPARENT_BACKGROUND_RULE`), where it outranks the recipe's "the brief is fixed" on the
  setting only; plus an Enhance-dialog warning when the enhancement's No Background state no
  longer matches the toggle (`_transparentMismatchNote`).
- t2i_020 / t2i_021, re-enhanced: 35.0% clear on t2i_020 (engine temp PNG), subject cut out
  with the water she stands in kept. Fabio: "It worked ... to me, this is a win."
- `npm test` after the fix: 3022 pass, 0 fail, 2 skipped.
- Raw prompt, no Enhance ("A woman in a monokini on a beach with water up to her knees"):
  t2i_022 56.6% clear + 16.2% partial, t2i_023 39.6% clear (sky gone, beach kept). Works, less
  reliably when the prompt names a place. The typed prompt had no full stop and ran on into the
  suffix; `withTransparentPrompt` now closes the sentence (test added).

- Edit (edit_003, "Remove the background." on Sunny beach beauty, Input_wf_type 4): RGBA,
  76.5% clear, 2.4% partial, a clean cut-out of the woman. Fabio: the live preview already
  outlines what stays.

## Owed

- [x] An edit with No Background on.
- [x] Cosmo, asked for a no-background picture with no model named: Krea 2 t2i then
  removeBackground ("Man walking dog"), one of the two routes the guide offers; Fabio accepts it.
  Asked to use Qwen 2.1: plain t2i (`Input_wf_type` 1), `transparent` sent, the RGBA sentences
  once each round a subject-only prompt ("...and from any background."), licence warned in chat.
- [ ] The Enhance-dialog warning when the toggle no longer matches the enhancement.
