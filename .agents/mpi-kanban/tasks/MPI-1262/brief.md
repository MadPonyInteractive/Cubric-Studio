# Cosmo knows a card's entries (MPI-1262)

Fabio, 2026-10-23, live in project "Moss image": a tiled detail pass on a MOSS-Image picture made in
its Anime style went to ILL Anime (Cosmo's best installed anime model) and changed the look. Asked to
use the original model instead, Cosmo said it could not see what made the original: it only ever
gets the entry on screen. Picked by button, the Moss re-run then ran with style 0, not the
original's style 1.

## Root causes

1. The App state line and `list_cards` read ONE entry of a card (the selected one). The other
   entries, and which entry an edit was made FROM, never reach the agent.
2. Nothing asks which model redraws a picture another model made, and nothing carries the
   source's style when the same model redraws it.
3. A mask is stored per entry. Once a masked edit lands, the result is on screen and holds no
   mask, so "do it again" runs on the result, whole-picture.

## What ships

- Card entries: on a card, the App state line lists the card's entries (model, op, style, which
  entry each was made from), registered so `look`/`generate` take them. `list_cards <groupId>`
  carries the same `entries`.
- Model card (`CHOICE_CARDS` kind `model`): an `upscale`/`detail` run on a picture another
  installed model made asks first: the original model (with its style) as the primary, the
  agent's pick, and up to two more installed models of the pick's category that run the op.
- Style: a detail/upscale on a picture made by the same model, with no style named, keeps the
  source's style.
- Masked redo: the renderer remembers the last masked edit's mask and picture; the state line
  says which entry it was; a run on that entry while it is not on screen reuses that mask.
