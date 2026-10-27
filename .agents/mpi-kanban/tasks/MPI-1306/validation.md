# MPI-1306 validation

## Box room (MpiStepBox)
The overflow padding is sized so a box of the step's ratio can cover the whole picture
(`coverH = max(H, W / ratio)`). No ratio = 1, the same room as before, so Head Swap's box step is unchanged.
Not eye-tested in the app yet: Fabio's look on a square picture is the remaining check.

## Person-or-not wording
- Describer (qwen3-vl 4B, the local one, temperature 0.2, each picture asked twice): the six mascot
  pictures OTHER 12/12; five people (front, phone, smoker, three-quarter, anime) PERSON 10/10.
- Sheets (Qwen-Image 2.1, 25 steps, Fabio's robot face + body, box widened to the whole head):
  - v1 wording: jumpsuit, ear and human proportions gone, but the back view was headless on 2/2 seeds
    (`research/v1_headless_back.jpg`). The old wording on the same seed kept the head (control).
  - v2 wording (head named in every view): head on the back view 3/3 seeds (2342348518, 42, 7) plus the
    camera mascot with no body picture (`research/v2.jpg`). Seed 7 drew its back view smaller than the front.
  - Human (PERSON, front face, seed 42): the person wording, byte for byte as before (Output_prompt checked).
- Before/after on Fabio's own run: `research/before_after.jpg`.
- Tests: flow-describe, inject-params-titles, flow-model-choice, flow-legs 86/86.
