# MPI-678 Brief

Archive a gallery card out of sight without deleting it.

Archive ships as a **scope** (`active` / `archived`), not a seventh filter tab:
`favorites` is additive (a fav still shows under All/Images), archive must be
subtractive. As a scope, the type tabs, Favs, Previews and sort all keep working
inside the archive.

Second leg: the Record button moves out of the gallery toolbar's centre zone to
the project bar beside Flows, which is what unsquashes the two sliders. Record
must stay gated to the gallery page — `media:imported` only has a listener while
`MpiGalleryBlock` is mounted.

Design approved in brainstorm 2026-09-01. Do not re-open it. Full detail: `plan.md`.
