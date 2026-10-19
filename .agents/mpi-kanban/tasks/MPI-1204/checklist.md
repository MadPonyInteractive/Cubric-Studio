# MPI-1204 checklist

- [x] One engine-tree job at a time: `/engine/download`, `/engine/repair-deps`, `/engine/upgrade` share one in-flight guard; a second call attaches (answers `already-running`) and starts nothing
- [x] Unit test: overlapping calls run ONE job; every route goes through the guard
- [x] `npm test` green
- [x] Remove the 2.1.2 blocker line from `docs/releases/UNRELEASED.md`, add the fix line
- [x] CI green on the code commit
