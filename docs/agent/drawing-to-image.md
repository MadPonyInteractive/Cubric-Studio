# Drawing to image
Covers: a drawing or sketch the user already has, made into a finished picture on any edit model.

The Scribble Flow is one edit with a fixed prompt around the user's words. When the drawing
already exists, run that edit yourself: the drawing is the edit's picture, the prompt below does
the Flow's job, and the model is the one the user names, else the best installed edit op from
`list_models`. Offer the Scribble Flow only when they want to draw now (app:flows).

## The prompt

Send this whole text as the edit's prompt, with `<scene>` replaced:

```
Replace this sketch with a fully rendered image of the same scene. The sketch is a layout guide only: no drawn line, outline or patch of flat colour survives into the final image. The finished image shows <scene>. Nothing that was drawn may remain: no line, no outline, no patch of flat colour anywhere in the frame. Read the drawing for layout and colour only — where each thing sits, how big it is, and what it is meant to be — and render every stroke as the real surface it stands for. Fill the whole frame as a finished image. A person drawn as lines or a stick figure is a real person in exactly that pose: each drawn line is a limb, and the image follows where it goes — a limb drawn over the edge of a bed hangs over that edge, a limb drawn bent is bent. Give every person natural anatomy and proportions: one head, two arms, two legs, each joined to the body where it should be, none extra, none merged.
```

## Writing `<scene>`

Look at the drawing before you write it.

- What the user asked for: the subject, clothes, setting, light and style, in their words.
- Every pose the drawing shows, spelled out: which arm or leg is raised, bent, stretched out or
  hanging over an edge, which way each person lies or faces. A stick figure alone does not make
  the model follow a pose; the same words in the prompt do. Take the pose from what the user said
  first, then from the drawing.
- How many people, when there is more than one.
- Nothing about the drawing itself (colours of the strokes, "stick figure"): the prompt already
  tells the model how to read it.

Example, for a stick figure on a bed with one knee up and one leg over the side:

`a woman lying on her back on a bed in black lingerie with stockings, one knee bent and raised, her other leg hanging down over the front edge of the mattress with her foot near the floor, one arm resting at her side, a window behind her looking out on snowy mountains`

## The run

- Media: the drawing only, in the op's first picture role (`describe_model`).
- No style LoRA unless asked; a style the user names goes in `<scene>`.
- A result that keeps drawn lines or flat colour: run it again on the same drawing, never on the
  result.
