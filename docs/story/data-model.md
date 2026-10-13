# Story card — data model (DESIGN)

> Part of [README.md](README.md). Shape is a starting point for the MPI-1134 plan, not a frozen
> schema. Field names follow the repo's camelCase.

## Where it lives

- A **Story card** is a new gallery card kind in the project. Its recipe sits in the card's
  sidecar — the same pattern as Mix (MPI-917, `js/data/mixRecipe.js` planned) and GIF.
- Opening it shows the **Storyboard** workspace. One project may hold several Story cards
  (alternate versions come free).
- Card import between projects (exists in the app) moves a Story card between episodes.
- Elements are **global** and are referenced by id; a Story never copies an Element.

## Shape (sketch)

```
story
  title, logline, targetSeconds
  continuity            project-level look: style, pace, soundscape, cameraGrammar, lighting
  cast[]                elementId + role in this story (character | location | prop | vehicle | animal)
  scenes[]
    id, order, heading, action (prose), locationElementId, castElementIds[]
    dialogue[]          { speakerElementId, line }   (verbatim, numbered)
    shots[]
      id, order
      kind              speaking | character | broll | location
      description       camera + motion brief
      shotSize          wide | medium | closeUp | insert | overShoulder
      dialogueCovered[] indices into scene.dialogue — every line covered exactly once
      targetSeconds     1-5 by default
      elementPicks      { elementId: { group: fileId } }  — the SHOT owns its picks (MPI-815 rule 3)
      modelId, opId     chosen per shot (see shot-pipeline.md)
      prompt            written + reviewable before queueing
      join              how it starts from the previous shot (continuity.md)
      stateAfter        how the shot ENDS — the stopping point, read by the next shot
      takeGroupId       the take card (GROUP id); its selected history entry is the current take.
                        Story → Mix resolves the selected ITEM id at assembly (Mix stores item ids)
      status            planned | promptApproved | drafted | upscaled | approved
```

## Rules

- **Two levels, scene and shot** (taken from Calliope): scene = screenplay unit, shot = render
  unit. A shot covers zero or more dialogue lines; every line is covered exactly once.
- **`stateAfter` is the stopping point written down.** The next shot's `join` reads it.
- **Continuity record updates incrementally** — editing one shot touches that shot's entry,
  never a whole-board LLM rewrite (Calliope's weak spot).
- **A take is a card, passes are history.** Draft, edit, upscale, detail each append an entry
  to the same card. The Story never stores media paths, only `takeGroupId`.
- **The recipe is a `story` block on an ITEM sidecar** (GIF pattern): `serializeGroup()` is a
  whitelist, so a group-level field would be silently dropped.
- **Importing a Story card copies its take cards with it** and remaps ids (MPI-1136); today's
  "Add to project" copies only the selected item, which would leave dangling refs.
- **Status is set by the user for `approved`.** Nothing is final after upscale on its own.
- One data shape, three writers: the Storyboard UI, Cosmo, and MCP (connector routes). No
  writer gets a field the others cannot reach.

## Open

- Exact sidecar location and how a Story card renders in the gallery (thumbnail = first
  approved shot?).
- Whether `continuity` per shot is its own object or folded into the shot fields above.
