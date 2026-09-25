# MPI-915 checklist

Fabio (2026-09-25): no way to remove a third-party Flow from the UI except deleting its
folder, and nothing shows where that folder is. Wants a button that opens it, next to Refresh.

- [x] `GET /user-flows` also answers `dir` (the `user_flows/` path the scan just created)
- [x] `userFlowService` keeps it; `userFlowsDir()` getter
- [x] Flow Library: `folder` ghost button beside Refresh → `POST /open-folder`
- [x] `docs/flow-packages.md` § Install, refresh, remove names the button
- [x] test pins `dir` in the route answer; live check in `app:isolated`
