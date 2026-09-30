# MPI-910 brief

## Noticed

- 2026-10-01 (Agent 79): the prompt box's reference picker inserts `<Image 1>` (`MpiPromptBox.js` ~1596), but in
  Seedance 2.0 `<...>` marks a SOUND EFFECT. The Higgsfield prompt-builder skill
  (`private/seedance-skills/prompt-builder-2-5.skill`) tags by load order, `@image1` / `@video1` / `@audio1`;
  ByteDance writes `@Image 1`. FIXED same day on Fabio's yes (`capabilities.atRefTags`). The ref2v op help's
  example still shows `<Image 1>` (op-level, shared with Wan).
- 2026-10-01 (Agent 79): the recipe's t2v/i2v "no reference tags" check is `@(Image|Video|Audio)\s?\d`, case-
  sensitive, so it misses the skill's lowercase `@image1`.
- 2026-10-01 (Agent 79): the `seedance-2.0` enhancer recipe has no ref2v mode, so Enhance on a Seedance ref2v
  prompt runs the t2v mode (which bans `@Image` tags). A ref2v mode is a `/create-enhancer-recipe` job.
