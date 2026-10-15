# MPI-1152 validation

## Bench (2026-10-15, Fabio's yes, DeepInfra `google/gemma-4-26B-A4B-it`, 126 calls, $0.003)

The app's `/llm/describe` call replayed (image + question, one user message, no temperature,
<= 1 MP JPEG q85). 14 pictures x 3 questions x 3 repeats; every picture answered the same 3 of 3.

| picture | old question | new question | "visible genitals / breasts / bare bottom?" |
|---|---|---|---|
| cartoon monkey on a white horse (the refused run's first frame) | YES (refused) | NO | NO |
| baby monkey on a tiger | NO | NO | NO |
| cartoon monkey + horse, black and white | YES (refused) | NO | NO |
| purple fox character on a tiger | NO | NO | NO |
| purple fox character on a lion | NO | YES (refused) | NO |
| robot mascot; shape characters | NO | NO | NO |
| three generated 10-year-olds (photo, painted) + an anime boy | YES x4 | YES x4 | NO x4 |
| three adults (25, 30, an old man beside a bear) | NO | NO | NO |

- The monkey refusal was a bare YES, not chatter.
- The anatomy question said NO on every clothed child, so as a trigger it never fires on
  "remove her clothes" over a clothed child photo: rejected as a replacement for the words trigger.
- Not covered: no nude picture, the ComfyUI 4B describer (GPU busy), 14 pictures only.
