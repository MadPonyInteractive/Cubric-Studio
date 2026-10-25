# MPI-1231 Validation

## Phase 1 layout (user-ux)

- 2026-10-25, Fabio in his app after a reload (screenshots): "Looks right." Characters and places =
  numbered tile grid (1-3 filled, one empty tile 4), info column beside it, not pushed down. Generate
  step: Video shape 16:9 / 9:16 / 21:9 / 1:1, Size 1K / 2K, Turbo. Layout VERIFIED.

## Phase 0 panel recipe (user-ux)

2026-10-25 ("LTX 2.5 model 13"), G: bench :8188 under the lease, Fabio's yes. Script + outputs:
`research/phase0/bench.mjs`, `out/` (v1 plans), `out_v2/` (v2 plans, 18 panels, `*_sheet.jpg`).
Boards: tikori (16:9, 3 refs from Tikori Characters, edit), diner (16:9, t2i), kite (9:16, t2i).

- **Planner v1 (the shipped DRAFT) FAILS consistency in text:** from panel 2 on it writes "the same
  waitress / the same boy" instead of the description, and with pictures it invents their looks
  (Bix green eyes, Snow yellow eyes) and never says "from the first image". Parses fine (6/6, ~25 s).
  Not drawn.
- **Planner v2:** the 4B writes a `[CAST] Name: description` block once; CODE appends the cast line
  of every cast name a panel mentions. For pictured characters the user's own "Picture N is NAME, a
  WHAT." replaces the line with "the WHAT from the Nth image" (the 4B kept inventing looks even when
  told it cannot see them). 15-21 s per plan.
- **Panels (FLUX.3 Klein turbo 1K):** edit with 3 refs ~47 s/panel, t2i ~14 s/panel. Cast holds across
  every panel that names them (tikori from the refs; diner Lena 6/6; kite boy + grandfather). Panels
  read in story order. No rendering defects seen.
- Faults seen: (a) a panel that says "him" instead of the cast name gets no cast line -> stranger
  changes (diner 2, suit not leather jacket); (b) dialogue in the Picture text renders as lettering
  (diner 3 badge, 6 book cover); (c) a reference showing a second animal leaks it in (tikori 4-5: an
  orange tiger from picture 2's mount); (d) "hands reach" drew human hands (tikori 6).
- **Shipped prompt (v2 + "name every time" + "speech in the Intent"), run once (`out_final/`):** 6/6
  panels per plan, 19-21 s. Caught a PARSER bug the v2 bench hid: the enhancer deletes newlines with
  no space, gluing cast lines ("nervous energy.Jasper: A man"), so Lena's line was lost and Leo's
  swallowed "Grandpa". Fixed (names may follow a full stop; a multi-word name also matches one of its
  capitalised words, "Grandpa" -> "Grandpa Finn"), test from the verbatim text. After the fix every
  panel gets the right cast lines on all 3 boards. Still seen: quoted speech in one diner panel; a
  closing panel that names no one ("three creatures") gets no cast line. Panels not redrawn.
- Fabio's eye, 2026-10-25: PASSED ("that is so freaking cool. I got a tear in my eye ... Yes, port V2").
