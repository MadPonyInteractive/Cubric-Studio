# MPI-1088 - Hairstyle picker: pick a style by picture, a colour or two and how they mix

Fabio, 2026-10-11. **A later version - deliberately not blocking the release** ("so that we are not blocked by
this at this point"). For the Character Sheet Editor's Hairstyle change AND the Character Sheet creator.

## The idea

When no Reference picture is given:

- **Style:** a dropdown (or grid) of hairstyle PICTURES - the haircut only, no face, or a mannequin head, whichever
  reads best - with a **man / woman filter**.
- **Colour:** a hair colour picker.
- **Second colour (optional):** a second picker; when set, a dropdown or radio group for **how the two mix**
  (highlights, gradient, ...). That control only appears with a second colour.
- The Flow builds the prompt from the pick + colours.
- With a Reference picture, none of these show: the picture is the hairstyle (MPI-1086).

## Depends on

- MPI-1086 (a hairstyle Reference picture that works) - the style pictures may themselves be fed as the reference.
- Fabio's test that "black and pink" read as two zones, not a pattern (MPI-1086 brief): the mix control is the
  structured answer to that.

## Open

- Where the style pictures come from (generated once, shipped as assets?) and their licence.
- Component shape: a picture grid component may already exist (Flow Library tiles, LoRA browser) - reuse first.
