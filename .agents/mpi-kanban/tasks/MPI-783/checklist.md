# MPI-783 — checklist

Root cause: `--dry-run` stages no shippable artifact (the approval gate already skips it for
that reason), yet it wrote to every output a real build owns: the same stage root name in the
same default stage dir, the same archive names, and the tracked
`resources/cubric/update-manifest.json` mirror. The 2026-09-12 run from `aabc9898` hit all
three (details: `tasks/MPI-782/validation.md`).

- [x] Dry-run stage and update roots carry a `-dry-run` suffix, so no stage dir can collide
- [x] Dry-run never archives and never mirrors the source manifest
- [x] Test: a spawned dry-run over a sentinel real build leaves it byte-identical and writes no
      archive, and parsed dry-run options disable the mirror; fails without the fix
- [x] Contract doc + help text say so
- [x] `npm test` green
