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
