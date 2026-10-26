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


## Panel models: FLUX.3 Klein vs Qwen-Image 2.1 (2026-10-25, LTX 2.5 model 17, local GPU under the lease)

Same DeepSeek plan (fixed planner), Fabio's 3 Tikori pictures (hairless cat = Sphinx, white tiger =
Jubie, purple fox on a lion), 6 panels, seeds 1231100+, 1344x768 edit, FLUX.3 Turbo. Script and
sheet: research/models/ (bench.mjs, sheet_flux3_vs_qwen21.jpg). Time: FLUX.3 ~49 s/panel, Qwen ~78 s.
- Both: panel 3 draws the Egyptian Sphinx monument (the name is a real thing; the note said only
  "the bad guy", so nothing says cat). Both leak an extra ORANGE fox in panels 4-5 (Qwen) / 4 (FLUX.3).
- FLUX.3: Jubie drawn as a standing humanoid tiger warrior (panel 5, note "protector warrior"); panel 6
  puts the Sphinx in the friendship shot instead of Jubie.
- Qwen 2.1: panel 1 walks the Sphinx and Jubie instead of the fox and the lion; panel 6 right (tiger,
  fox, lion); keeps the tiger a tiger.
- Read: neither model wins clearly; most misses trace to the NOTES (no species), not the model.
  Fabio's verdict pending.

## Describe-first planning, live (2026-10-25, LTX 2.5 model 18, DeepInfra, $0.0006)

Same 3 Tikori pictures, notes and idea as the panel-model bench. Each picture described with the new
STORYBOARD_PICTURE_ASK on the DeepInfra recommended describer (google/gemma-4-26B-A4B-it, ~$0.00003 a
picture), planner source built by pictureSentences(notes, looks), one plan on DeepSeek V4 Flash 0731
(effort low, $0.0005). Script: scratchpad livecheck.mjs; output: research/models/describe_first.json.
- Looks: "a hairless grey and pink cat with large ears, wrinkled skin, and a stout body" / "a white
  tiger with brown stripes, a fluffy, muscular body, and a calm expression" / "a purple fox-like
  creature riding on the back of a large, tan lion with a brown mane". All right, one phrase each.
- [CAST] copies them word for word + "from image N"; the joint picture is split sensibly (Fox: a purple
  fox-like creature from image 3 / Lion: a large, tan lion ... from image 3).
- Panels: no monument, Jubie stays on four paws (lunges, roars), panel 6 is Jubie + Fox + Lion. No looks
  in any Picture. One slip: panel 2 gives the Sphinx "one paw raised, palm facing out".
- Parsed panel 1 ends "Fox is a purple fox-like creature from image 3. Lion is a large, tan lion with a
  brown mane from image 3." Not drawn (no GPU run); not seen in the app frame.

## Crowd + 4-picture cap, live (2026-10-26, Storyboard 22, DeepInfra $0.0006 + ONE local GPU run)

Fabio's bat-cave idea (his sidecar's flowInputs), no pictures, 6 panels, 16:9, FLUX.3 Klein, turbo.
Re-plan on DeepSeek V4 Flash 0731 (research/crowd-cap/out.json): Bats NOT in [CAST] (a swarm in words
per panel), Gold Helmet + Gold Elephant in [OBJECTS]. The real driver (FLOW_DRIVERS.storyboard) run in
MY Electron instance (own profile, port, APP_DOCUMENTS; engine 48188 shared, GPU lease), 7m42s, no
Stop (research/crowd-cap/gpu/: run.cjs, result.json, refs.jpg, sheet.jpg).
- Drawn first: Squirrel, Rabbit, Bat Cave Interior, River (4 = MAX_DRAWN_FIRST); toast "Gold Helmet
  stays in words: at most 4 pictures are drawn first." Then 6 panels, reordered, numbered sheet.
- Read: the same squirrel (blue backpack) and rabbit (green hat) in all 6 panels, anime style held;
  bats as red eyes / a swarm (no lone bat on grey); the helmet drawn from words, consistent 2-3.
- Weak: the River reference came back photo-like and panels 5-6 water reads photoreal; panel 1 is
  INSIDE the cave though the plan says the entrance (the interior picture rides every panel).
  Rabbit's default face reads cross. For Fabio's eye.
- FOUND + FIXED: "1 of 6 did not finish" while all 6 landed. Panel 5 ("arms and legs spread") waited
  for the child-safety judge outside every queue; panel 6 ran and landed, the stack settled at 5 of 6,
  panel 5 landed after. generationService _holdUntilQueued counts a judge/tile-describer hold as
  live (test in child-safety-gate, fails without it). Also: the Cast stack took the panels' name
  (truncation cut " · Cast"), fixed. Neither re-run on the GPU (one run approved).
