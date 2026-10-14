# MPI-1096 validation

Research card, closed on Fabio's pick (2026-10-14): **"The app today, as is, with one shared sheet, works fine in
higher resolutions."** No code shipped; the only repo edit outside the card is a doc section.

## Evidence
- 50+ bench clips, LTX 2.3 Balanced int8, local RTX 4060 Ti under `gpu_lease`, own ComfyUI on :8199 from
  `G:\ComfyUi` (Fabio's :8188 bench and its BFSNodes 1.4.0 untouched). Scripts: `research/bench/`; per-run read,
  times and Fabio's eye tests: `research/shortlist.md` § Pass 2; workflow diff: `research/workflow-compare.md`
  (sub-agent report, claims checked by hand; its "Gemma sees the face" claim was WRONG, noted).
- Fabio's eye tests: Ingredients + Best-Face-ID best of three on single characters; LoRA alone = a different woman;
  final verdict above after the two-character / setting benches.

## Dropped, with reason
- Best-Face-ID: no licence terms -> cannot ship; alone it changes the face.
- One IC guide per character/picture: 3 guides collapse, 2 guides 1/4 usable, ~2x time.
- SyFe / AviadDahan "ID-LoRA": voice identity, not face.
- Detailer off / NAG off / richer face text: small or no effect.

## Follow-ups
- MPI-1139: a single portrait picture reaches #903 unfilled and is padded black (reproduce, then fill).
- Not tried: a start frame with both faces right (image editor) + the shared sheet; LTX 2.5 Ingredients.

## Docs
`docs/models/ltx/reference-ingredients.md` § Face identity (MPI-1096) - 13 lines, file at 143 lines.
