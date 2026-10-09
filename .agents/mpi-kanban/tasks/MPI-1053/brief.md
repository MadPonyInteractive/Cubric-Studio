# MPI-1053 brief

Cosmo (the in-app agent) and the MCP tools must know every way the app can add detail or
upscale, what each one does to the picture, and choose by the picture's size and the user's
words, or offer the choice when it is a judgement. Born in MPI-1038 (Use Tiles), 2026-10-09.

## Fabio's spec (2026-10-09, his words, lightly cleaned of dictation)

"There are many ways of adding detail. Cosmo should instruct the user, and respond accordingly."

The routes and what they do:

- **Image-to-image (i2i)** can add detail, e.g. to a picture that was upscaled straight from a
  poor-quality one.
- **Upscale with an image model**: normal upscale, Grid upscale, Tile upscale. All add detail;
  normal and Grid make the picture bigger; Tiles can keep the size (**1x = detail only**) or
  enlarge.
- **A mask on an area** + the Detail op adds detail to that area only.
- **An edit op does not usually add detail.** (Edit graphs scale the input to 1 MP.)
- **Image-workspace tools**: basic upscale, and basic upscale with an upscale model. Both are
  plain enlargements, no new detail.

The decisions:

1. **Small picture (~1K / 1 MP) + "add some detail, it needs detail"** -> Cosmo offers TWO
   buttons: try image-to-image | try tiled detail (Tiles at 1x).
2. **Detail on ONE thing** ("this lady's face", "the chair on the right", "the water", "the
   mountain") -> "Paint a mask over it and I'll detail it" (the Detail op).
3. **Big picture (2K or more) + "detail this image"** -> default straight to Tiles at 1x, no
   question.
4. **"Upscale"** -> Cosmo knows the kinds: basic upscale, basic upscale with model (the image
   tools), and with an image model: normal, Grid, Tiles. **For very large sizes, normal upscale
   and Tiles are the preferred methods.**

"We can't make Cosmo decide everything, so make sure Cosmo knows what each option does and
figures out what's best for the task."

## Hard constraint (Fabio)

**Adjust the existing instructions; do not add on top.** Every added line confuses Cosmo and
costs tokens on every request, and raising the prompt budget each time is the failure. The
system prompt and tool schemas are byte-budgeted (`tests/agent-prompt-budget.test.cjs`); this
card should leave them the same size or SMALLER, moving detail into the op notes / a gated
app doc that is read only when the task is detail or upscale.

## Noticed
