# MPI-1305 validation

## Done and verified

- **Markdown plan.** `storyboardPlanMarkdown` turns the planner's answer into `# Storyboard plan`,
  `## Cast` / `## Places` / `## Objects` (`- **Name**: ...`) and `## Panel N` (`**Picture:**`,
  `**Intent:**`). It is written through `enhancedWrites` (`writeAs: 'storyboardPlan'`), so the
  hand run, the agent Flow run and the agent Storyboard get the same text.
- **Parse unchanged.** `_plain` turns the Markdown back into bracket markers before every reader.
  Tests: Markdown and bracket parse to identical panels, recurring actors and drawn picks, for
  Fabio's glued movie-set plan and the diner bench plan; converting twice changes nothing; an
  answer with no panel is left as it came.
- **Root cause of the glued names.** The enhancer graph's Replace Text deleted newlines with no
  space ("crew trailersDirector's Station" became a place named "Station", "hinged topCamera" lost
  Camera). The planner now sends `'Replace Text.replace': '\n'` (identity pass, as llmService's job
  params do). A test shows the newline-kept answer splits every name.
- **UI.** The `plan` field is the new `markdown` field type: a small secondary "View plan" button
  (eye icon), disabled while the plan is empty, opening MpiNotesEditor (preview mode, Edit/Save).
  The idea box is `rows: 16`. Seen in an isolated instance (port 59907, scratch profile and
  documents): disabled with no plan; enabled once a plan landed through the frame's write path;
  opens rendered; after Save the frame holds the value (Plan with Cosmo repainted as filled, the
  button still enabled after a slide rebuild).
- `npm run lint` clean (eslint + typecheck); full `npm test` 3761 pass / 0 fail before the final
  typecheck rename; the touched suites re-run after it: 105/105.

## Not verified

- A real Plan with Cosmo press (needs a paid model connection; not spent). The plan was pushed
  in through the field's `setValue`, the same call an Enhance answer makes.

## Waiting on Fabio

- The look: screenshots in the side-session notes folder (storyboard-plan-1/2/3).

## Follow-up: per-panel references (2026-10-27)

- Two new tests in tests/storyboard-runner.test.cjs failed before the fix (pictures/description) and pass after; 24/24 in the suite.
- Not verified: a real panel run on the GPU. Built per-panel reference lists are covered by the pure tests only; the dispatch wiring (_panelsWithReferences) is checked by lint/typecheck, not a live run.
- Live run 2026-10-27 (isolated instance :53661, FLUX.3 Klein, 5 idle mascots + plan sent by hand, no paid calls, 228 s): every panel got exactly the pictures it names (sidecar generationSettings.mediaItems: P1 Lingo, Cosmo, Film Set, Clapperboard; P2 Reel, Prism, Film Set; P3 Vinyl; P4 Vinyl, Cosmo, Reel, Prism, Clapperboard) and the pictured lines carried no looks. No merged or duplicated robots. P4 (4 robots + 1 object in one edit) drew only 3: Cosmo is missing, and P2/P4 came out flat 2D like the source art.
- Re-run with the style line matched to the art ("Flat 2D vector cartoon illustration"): all 4 panels and both drawn pictures in one flat style. The first run's clash (P1 glossy 3D) came from my hand plan's "3D-animated" line fighting the flat art, carried by the 3D drawn pictures; the planner is already told to open on the pictures' style (STORYBOARD_PICTURE_ASK names it first). P4 again drew 3 of 4 robots (Cosmo missing both runs): a FLUX.3 Klein limit with 4 characters + 1 object in one edit, not chance.

## Follow-up: panel 4 drops a robot (2026-10-27, Storyboard Improvements 3)

- Not a hard model limit: the prompt never said how many. Controlled FLUX.3 Klein edits at the panel's seed + seed 12345 (isolated instance, local GPU, no paid calls; cards "P4 <variant> s<seed>", edit_009..024 in the scratch project). Four robots drew 3 in 8/8: exact repeat, no clapperboard (picture + words), Cosmo moved to image 1, no lifting action. Three robots: 3 in 2/2. Naming the headcount ("Four robots stand in a row, from left to right ..." or "Four characters are in the picture, each one whole and clearly visible: ...") drew 4 in 6/6; each robot its own in 4/6, the other 2 blended two robots.
- Fix: `_headcount` in storyboardRunner.js ends any panel naming 3+ [CAST] characters on that line. Test-first (the new test failed, then passed); the existing diner test caught a picture-only line counted as a character, so only kind 'character' counts. Full npm test 3764 pass / 0 fail, eslint clean.
- Live: the same board re-run through the Storyboard Flow (instance :61124, sheet_003). Panel 4's prompt carries the line and draws 4 robots with Prism's face visible. Not perfect: Cosmo has its own body and C logo but Vinyl's headphone head, the identity bleed the variants showed in 2/6. Panels 1-3 get no line (2 or fewer characters).
