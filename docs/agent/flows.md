# Flows

A Flow is a ready-made recipe (Head Swap, Outpaint, Text to Speech, a character sheet), run
with `generate` and a `flowId`, never a `modelId`. `describe_model` with the Flow's id gives its
fields, its media roles, and any boxes or frame it takes.

## Fields hold only what their names say

A field is a value, never an instruction to the Flow. Head Swap's `positive` is the expression
the new head ends with, not a description of the swap.

- Right: `positive: "a calm smile"`
- Wrong: `positive: "swap the woman's head onto the man's body, keep the lighting"`

## Boxes: measured, never guessed

A Flow whose `describe_model` answer lists `boxParams` needs one box per param. For each:

1. Call `look` on the image you pass for that param's role, with `box: true` and a question
   naming what to box. Head Swap boxes the head, hair and jaw included.
2. Pass `output.square` when the step has ratio 1, else `output.box`.

`generate` refuses a box it did not see you measure (`BOX_NOT_MEASURED`), and a box that took
the whole person (`BOX_TOO_BIG`). `look` reports `boxShare` and `squareShare`, what the box and
its square take of the image; a head is a small part of a photo.

When `look` says the box is too big, measure that image once more with a question that says
head only, or on a crop around that person. If the second is still too big, stop: tell the user
which photo you could not measure and ask them to crop it to the head. Never a third attempt.

## Outpaint: the frame and the side that grows

A Flow whose entry declares `frame` takes the shape the picture grows to, from that entry's own
ratio list: `params: { frame: { ratio: "9:16" } }`. A taller shape grows the top and bottom
evenly, a wider one the left and right.

When the user says which side the new room goes on ("expand it up", "more sky", "room for a
title above"), add `grow`: `params: { frame: { ratio: "4:5", grow: "up" } }`. Up and down need
a TALLER shape than the picture, left and right a WIDER one.

- Right, for "expand it up" on a 1:1 picture: `{ frame: { ratio: "4:5", grow: "up" } }`
- Wrong: `{ frame: { ratio: "16:9", grow: "up" } }` (wider, so nothing can grow up)
