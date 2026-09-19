# MPI-818 Checklist

- [ ] `playwright.desktop.config.js`: `retries` on CI, so one flaky Electron boot is not a red master
- [ ] `tests/desktop/radial-menu.spec.js:168`: green on a runner with zero installed models
- [ ] `.husky/pre-push`: the block message tells the agent to FIX, and stops offering `--no-verify` as a way to accept the red
- [ ] `.agents/mpi-kanban/close-out.md`: a card does not close on a red run of its own commit
- [ ] `CLAUDE.md` § Git: one line making a red master the job of whoever meets it
- [ ] push, watch the run, green
