# MPI-818 Checklist

- [x] `playwright.desktop.config.js`: `retries` on CI, so one flaky Electron boot is not a red master
- [x] `tests/desktop/radial-menu.spec.js:168`: green on a runner with zero installed models
- [x] `.husky/pre-push`: the block message tells the agent to FIX, and stops offering `--no-verify` as a way to accept the red
- [x] `.agents/mpi-kanban/close-out.md`: a card does not close on a red run of its own commit
- [x] `CLAUDE.md` § Git: one line making a red master the job of whoever meets it
- [x] push, watch the run, green
- [x] five specs that used MPI-781's deleted display assets as fixtures (found on this card's own red run)
