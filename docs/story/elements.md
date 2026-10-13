# What Story needs from Elements (DESIGN)

> Part of [README.md](README.md). The Elements library itself is MPI-815
> (`.agents/mpi-kanban/tasks/MPI-815/plan.md` § "The design, as approved"). Everything below is
> ADDED on top of that design and fits it as-is: an Element is a folder of free text fields plus
> user-named groups of files or links, one ★ active item per group, and the pick belongs to
> whoever uses the group.

## Rule: the Story casts Elements, nothing else

Characters, locations, props, vehicles and animals enter a Story only as Elements. A character
sheet is a file inside the character's Element, never a loose reference image on a shot.

## Templates (pre-fill only — MPI-815 rule 9)

| Template | Fields | Groups |
|---|---|---|
| Character (exists in v1, extended) | name, age, appearance, personality, **mannerisms, strengths, weaknesses**, prompt_base | Sheets, Outfits, **Voice** (audio refs for H3 Reference) |
| **Location** | name, description, time of day, mood | **Angles** (one picture per area / camera position), **Ambience** (background sound) |
| **Prop / Vehicle / Animal** | name, description | Sheets, Angles, optional sound |

- A Location may **link** its props or vehicles (a car parked in the street).
- A shot's `elementPicks` choose inside the groups (the kitchen angle, the red outfit) without
  changing the Element's own ★.
- **Ambience** audio is laid under that location's shots automatically in Mix.

## Feeding Elements

| Source | Status |
|---|---|
| Character Sheet Flows | MPI-1091, near done |
| Prop Sheet (+ vehicles) | MPI-586 |
| Multi-angle Flow, one location → 4/6/8 angles | MPI-1039 |
| 3D Scene + 360 Panorama, exact camera positions | MPI-623, ships in 2.1 |
| Stable Audio 3 for ambience | shipped |

The sheet Flows must be able to **save straight into an Element** — MPI-815 lists the
sheet-builder link as a "Later" card; Story needs it.

## Text fields are the bible, not prompt injection

Cosmo reads personality / mannerisms / location description to write scenes and prompts.
They are never pasted verbatim into a model prompt (MPI-815 rule 8).
