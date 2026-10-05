# MPI-1023 validation

2026-10-05. Evidence the rule describes, measured on `js/components/Primitives/MpiCanvas/managers/InputController.js`:

- `git status --short` showed ` M`; `git diff` printed nothing.
- `git hash-object` (with and without `--no-filters`), the index blob and `HEAD:<file>` were all
  `a75d2e74`. `git ls-files --eol`: `i/lf w/lf attr/text eol=lf`.
- `git ls-files -s --debug`: index stat size 24105; file on disk 23613. 492 bytes apart, one per
  line: the cached size is from a CRLF copy.
- `git update-index --refresh` still said "needs update" (a size mismatch short-circuits the
  content check). `git add -- <file>` cleared it: status empty, nothing staged.

Rule line added to `.claude/rules/git.md` § Baseline, Fabio's yes in session.
