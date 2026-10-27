# MPI-1315 validation

Docs-only. Fabio asked (2026-10-27) for `@` to be written down as the app's one reference symbol,
and approved the `.claude/rules/dos_and_donts.md` edit in chat.

## What landed

- `.claude/rules/dos_and_donts.md` § "`@` is the app's one reference symbol": the rule, one
  matcher two popups, offer only what the run reads, the gates.
- `docs/at-picker.md` (new, 72 lines): the contract. Where `@` lives (prompt box: staged
  references + Box names; Flow field `tags`; `attachMentionPicker`), `matchRefTagQuery`'s edge
  cases, the `refTagHandle` table per model, the two-popups-on-purpose note, tests and gaps.
  Routed from `docs/README.md`. Not added to `docs/component-contracts.md`: that file is already
  217 lines, over the 200-line doc budget.
- `docs/playbooks/add-flow/README.md`: a checklist line after Controls.
- `.claude/skills/mpi-add-flow/SKILL.md` and `.claude/skills/mpi-add-model/SKILL.md`: one trap row each.

## Evidence

- Every path the new text names exists (checked with `test -e`, incl. both relative links).
- Facts read from code, not memory: `matchRefTagQuery` / `refTagHandle`
  (`js/data/commandRegistry.js`), `_syncRefPicker` / `_insertRefTag` (`MpiPromptBox.js`: positive
  prompt only, references then Box names), `declaredFields.js` (square wrap),
  `tests/ref-tag-picker.test.cjs` (model ops only, nothing for Flows).
- `git diff --stat`: insertions only (22 + 1 + 1 + 1 + 1), no whitespace churn.

## Gaps recorded, not fixed

- No test gates `@` for a Flow; the add-flow checklist line is the only gate.
- A declared Flow text box cannot name the Flow's own staged pictures (`tags` is a closed list).
