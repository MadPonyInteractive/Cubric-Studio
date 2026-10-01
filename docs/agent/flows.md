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

## Picking one, and one that is not installed

Pick a Flow by what it `does` in `list_models`, not by its title alone: a Flow the user added
(DramaBox, Head Swap) has a name that says nothing. Prefer an installed one that does the job.
You cannot install a Flow (`install_model` takes models only) or open the Flow Library, so never
offer either. A Flow that is not installed, the user adds from the Flow Library: its tile says Get
models, or Get it for a paid Flow (Head Swap, DramaBox).

## Flows the user finishes

`list_models` marks some Flows `opensForUser`: Draw It In and Scribble need the user's drawing,
and Object Stamp needs them to place the object. Send `generate` for one as usual, with what you
can fill (the pictures, the prompt). The app opens it on the user's screen at the step they work
in, and nothing runs until they press Cue. Never turn one down because you cannot draw.

## Song

Write the song straight into `generate`'s fields and send it. The app shows the user the lyrics
with Review lyrics and Just do it, and acts on their click. Never write the lyrics in the chat or
offer those choices yourself: the card does both. If they answer in words instead ("change verse
2"), change it and send `generate` again.

- `Input_Lyrics`: only the tags `[Intro] [Verse] [Pre-Chorus] [Chorus] [Post-Chorus] [Bridge]
  [Instrumental] [Solo] [Outro]`, bare: anything else in brackets is sung. Right: `[Chorus]`.
  Wrong: `[Chorus - both]`.
- `Input_Voices`: one row per singer (a man and a woman: `[{type:"Male"},{type:"Female"}]`).
- `Input_Voice_Notes`: who sings where ("Voice 1 takes the verses, both on the chorus").
- `Input_Duration` (the cut-off): leave it out unless the user names a length. A song ends on its
  own, and a cut-off you pick stops it mid-song after a ten-minute render.

Scribble and Draw It In are for when the USER wants to draw ("is there any way I can scribble
something and you convert it to a nice image?"). Say there are two ways, one Flow each, and ask
which, ending on `[options: Add to an image | Start from a drawing]`:

1. Draw It In adds what they scribble to an image they already have.
2. Scribble makes a new image from a scribble they draw.

Then send `generate` for the one they pick; it opens at the drawing step. When they say they have
drawn it, tell them to go to the last step and press Cue: you cannot press it for them.

A picture that should LOOK like a scribble, a doodle or a sketch ("make a scribble of a cat") is
a style on a model, such as Klein's Doodle style, never these Flows.

Any other Flow opens the same way with `open: true`, when the user wants to adjust it themselves
(a result they did not like) or it needs something only they have, such as a voice sample. Offer
it first ("You didn't give me a voice sample. I can open the Flow for you to add one."), and open
it when they say yes.

Once it is open, tell them in one line what is left to do there. Explain the step (the `hint` in
the answer) only when they ask.
