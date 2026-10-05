#!/bin/sh
# scripts/precommit-done-gate.sh - run first by .husky/pre-commit (MPI-1022).
#
# Refuses a commit that carries CODE and also moves a card to `done`. The pre-push done
# gate (MPI-819) can never pass that commit: it wants a green CI run on the card's code
# commit before the close lands, and here the two are one commit. The way out after the
# fact is a reopen commit plus a CI wait - paid on MPI-924 (2026-09-25), MPI-994
# (2026-09-30) and MPI-1020 (2026-10-05). Before the commit exists, it is one command.
#
# "Code" is the push gate's own definition: anything outside docs/, .agents/ and *.md.
# Same DOCS_RE as .husky/pre-push and tests.yml's paths-ignore - change all three together.
# A card closed as `rejected` ships nothing to judge, and passes here as it does there.
#
# ponytail: refuses ANY done move riding with code, not just the card the code belongs to.
# A close commit is board-only by convention, so there is no mixed case worth sparing.

DOCS_RE='^(docs/|\.agents/)|\.md$'

# Concluding a merge stages everyone's incoming commits, already split or not.
git rev-parse -q --verify MERGE_HEAD >/dev/null && exit 0

staged=$(git diff --cached --name-only) || exit 0
[ -n "$staged" ] || exit 0
printf '%s\n' "$staged" | grep -qvE "$DOCS_RE" || exit 0   # no code: a close commit is fine

column_of() { sed -nE 's/.*"column": *"([a-z]+)".*/\1/p' | head -1; }

blocked=''
for f in $(printf '%s\n' "$staged" | grep -E '^\.agents/mpi-kanban/tasks/[^/]+/task\.json$'); do
    card=$(git show ":$f" 2>/dev/null) || continue   # deleted by this commit
    [ "$(printf '%s\n' "$card" | column_of)" = done ] || continue
    [ "$(git show "HEAD:$f" 2>/dev/null | column_of)" != done ] || continue
    printf '%s\n' "$card" | grep -qE '"maturity": *"rejected"' && continue
    blocked="$blocked $(basename "$(dirname "$f")")"
done
[ -n "$blocked" ] || exit 0

echo ""
echo "[pre-commit] BLOCKED -$blocked moves to done in a commit that also carries code."
echo ""
echo "  The pre-push done gate wants CI to pass the code commit BEFORE the close lands,"
echo "  so this commit could never be pushed. Commit the code on its own:"
echo ""
echo "    git commit --only <these paths> -m \"...\""
printf '%s\n' "$staged" | grep -vE '^\.agents/' | sed 's/^/      /'
echo ""
echo "  then push it, 'gh run watch', and commit the .agents/ close once CI is green."
echo ""
exit 1
