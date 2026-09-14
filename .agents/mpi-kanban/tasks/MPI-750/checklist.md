# MPI-750 checklist

- [x] Reproduce: mount the real /project-stats route against project "test", group imported_014 -> {count:0, bytes:0} for 4 history entries
- [x] Replace the greedy `path=(.+)$` sidecar parse with `pathFromProjectFileUrl` at every remaining site (project-stats group mode, save-generation replace filePath + thumbPath)
- [x] Regression test in Node: tests/project-stats-group.test.cjs
- [x] Re-run the repro against the real project: count 4, bytes = sum of the four files
- [x] docs/project-integrity.md: the rule covers every sidecar parse, not only the GC
