# MPI-778 checklist

- [x] Confirm the live app and E2E / app:isolated instances resolve the same engine root
- [x] Desktop spec: a sentinel in a scratch engine's input/ and output/ survives an E2E quit (red on HEAD first)
- [x] Shared helper gated on engine ownership; main.js and routes/shared.js twins both use it
- [x] Fork reports ownership to main (spawn + exit) over IPC
- [x] Node test: owner empties, non-owner keeps
- [x] Desktop spec green; npm test green; lint clean
- [x] docs/worktrees.md caveat
