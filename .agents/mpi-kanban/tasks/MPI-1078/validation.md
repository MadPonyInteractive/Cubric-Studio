# MPI-1078 validation

The uninstall-toast half shipped in MPI-1076 (592c61562). This card covers the partial display.

## 2026-10-11 - df631df91

- Rule: a dep a plugin, a Flow or the engine needs drops out of a model's partial measure only
  while ON DISK (`partialInstall(deps, status, depsHeldOutsideModels(DEPS, [...PLUGINS, ...FLOWS]))`).
  Same set as the backend uninstall keeps. Used by MpiModelManager `_computePartial` and the
  MPI-1065 toast (`modelsMissingFiles`, incl. its 1 GB install proof). Engine-agnostic, so both engines.
- `node --test tests/model-update-check.test.cjs`: 14/14 pass. The same file with `held` removed:
  the Wan 2.2 and Krea 2 tests FAIL (2/14) - the tests bite.
- `npm test`: 3114 pass, 1 fail = `tests/text-op-completion.test.cjs`, caused by a peer's
  UNCOMMITTED `speechTranscribe` op in `js/data/commandRegistry.js` (MPI-1071 WIP, not in HEAD).
- eslint on the 4 files: clean.
- CI on df631df91: Tests run 38130233149 SUCCESS.
