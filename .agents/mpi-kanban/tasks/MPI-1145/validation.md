# MPI-1145 validation

- `tests/desktop/nodev-flag.spec.js`: launches Electron with `['.', 'nodev']` and `['.']`, reads
  `APP_CONFIG.dev_mode` in the window and whether the server's `/connector/models` lists the
  devOnly `flux-schnell-cloud`. nodev: false/absent; plain: true/present. 2 passed, then
  `--repeat-each=2` 4 passed (2026-10-14). The very first run timed out once at 30 s on the
  first (cold) Electron launch; an off-test probe of the same launch booted in ~5 s and every
  rerun passed in ~4 s.
- npm pass-through: `npm start nodev` delivers `nodev` as a positional arg in both Git Bash and
  PowerShell (npm 11.9.0). `npm start -- --dev=off` does NOT work in PowerShell (it strips `--`,
  node gets `--dev=off` and dies), which is why the flag is a bare word.
