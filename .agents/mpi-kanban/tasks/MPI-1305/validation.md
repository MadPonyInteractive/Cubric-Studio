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
