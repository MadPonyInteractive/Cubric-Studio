# MPI-1177 validation

## Problem

Fabio attached his drawing card to Cosmo ("turn my scribble into a nice image ... please use Nano
Banana") and Cosmo ran a plain Nano Banana 2 edit, not the Scribble Flow. By design Cosmo cannot
run Scribble (`agentOpens: 'paint'`, MPI-892: it only opens on the user's screen), and the Flow is
just Klein's edit wrapped in a fixed prompt. Fabio: as long as Cosmo has that prompting, it does
not need the Flow.

## Shipped

- `docs/agent/drawing-to-image.md` (indexed to Cosmo as `app:drawing-to-image`): the Scribble
  Flow's full prompt (node 103 + `<scene>` + node 184, including MPI-1176's pose sentence),
  checked to be the Flow's exact text in Python; how to write `<scene>` with every pose spelled
  out in words (the MPI-1176 bench: a hanging leg came out 3/3 only when the words said it);
  media and retry rules.
- `docs/agent/flows.md` left alone: claimed by a live peer (MPI-1086) and at the 200-line cap.
  The index line is enough for Cosmo to find the guide.
- `tests/agent-prompt-budget.test.cjs`: SYSTEM_BUDGET 11,682 -> 11,796 (+114, the index line),
  logged on the budget's own history line.
- `node --test tests/agent-prompt-budget.test.cjs tests/agent-corpus.test.cjs`: green.

## Fabio's live check (after an app restart, new chat)

Same drawing card, no model named -> Klein 9B edit (edit_002), then "use Nano Banana" -> Nano
Banana 2 (edit_003). Both sidecar prompts carry the guide's shape: the pose spelled out in words
("one leg hangs down off the front edge of the mattress, her foot near the floor"), no drawn line
survives, natural anatomy. Cosmo paraphrased the guide's prompt rather than copying it verbatim;
the parts that carry the result came through, and the Nano Banana render hangs the leg off the
bed. Both 1024x1024 (MPI-1178's ratio fix live).
