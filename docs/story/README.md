# docs/story/ — Story and Infinite Video (DESIGN, not built)

> **Status: design only.** Nothing in this folder is built yet. Umbrella card: **MPI-1134**
> (`.agents/mpi-kanban/tasks/MPI-1134/`). Brainstormed with Fabio 2026-10-13; post-2.1.
> When a piece ships, move its BUILT facts into a normal subsystem doc and leave a pointer here.
> New ideas for this feature land in the matching file below, never in the card JSON.

## What it is

A user tells Cosmo "I have an idea for a clip / an episode". Cosmo helps write the story, casts
it from **Elements** (characters, locations, props, vehicles, animals), breaks it into scenes and
short shots, and the user reviews all of it **before anything generates**. Then the shots render
as cheap drafts, the user reviews and redoes takes, approved shots are upscaled, detailed and
edited (each pass reviewed), and the sequence is assembled with ambience and music in **Mix**.

**Infinite Video** is the part that chains shots past any model's length limit: end each shot on
a natural stopping point (a close-up, two characters looking at each other) and continue the idea
in the next shot. It ships twice: inside the full Story pipeline, and as a one-click **Infinite
Video Flow** that outputs a Story card the user can open and fix.

## Terms

| Term | Meaning |
|---|---|
| Series / movie | Several projects. Not modelled; Elements carry identity across them |
| Project | One episode or one sequence block (e.g. a 3-7 min YouTube episode) |
| **Story card** | A gallery card (new kind) holding one sequence, ~30 s to 3 min, shareable on its own |
| Scene | Screenplay unit: a location, a cast, action and dialogue |
| Shot | Render unit, 1-5 s (longer only when a scene truly needs it) |
| Take | The shot's generated card; every pass (draft, edit, upscale, detail) is a history entry |
| Element | Global reusable record (MPI-815): text "bible" fields + groups of files |

## User journey

1. Idea in chat → Cosmo drafts story, cast (Elements), scenes, shots, dialogue.
2. User edits anything (Storyboard is fully editable; Cosmo is a helper). Every prompt is
   written and reviewable before any job is queued.
3. Draft pass → review → redo / edit takes.
4. Upscale pass → review → detail / edit → review → user marks the shot **approved**.
5. Story → Mix: shots on the video lane, ambience + music under, export.

## Files

| File | Holds |
|---|---|
| [data-model.md](data-model.md) | Story card recipe: scenes, shots, cast, continuity record, shot status |
| [shot-pipeline.md](shot-pipeline.md) | Model routing per shot type, draft → upscale → detail, history, audio |
| [continuity.md](continuity.md) | The Continue step: extend / last frame / new shot from refs / cut; stopping points |
| [elements.md](elements.md) | What this needs from the Elements library |
| [cosmo-and-flow.md](cosmo-and-flow.md) | Cosmo as director, MCP parity, card import, the Infinite Video Flow |
| [roadmap.md](roadmap.md) | Phases, blockers, card map |
| [decisions.md](decisions.md) | Dated decisions, rejected options, Calliope prior art |
