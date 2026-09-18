# MPI-807 checklist — Windows exe PE rebrand

- [x] `rcedit` added as a devDependency (bundles `rcedit.exe`; the win32 artifact is built on
      `windows-latest` in mpi-ci, so no wine path is needed)
- [x] `scripts/build-portable.mjs` runs rcedit on the STAGED `CubricStudio.exe` only, after the
      `electron.exe` -> `config.exeName` copy. Never on `node_modules`.
- [x] Fields written: icon `media/icons/cubric-vision.ico`, `FileDescription`, `ProductName`,
      `CompanyName`, `InternalName`, `OriginalFilename`, `LegalCopyright`,
      `ProductVersion`/`FileVersion` from `package.json`
- [x] Failure is LOUD — an unbranded exe is the defect this card exists for, so the build throws
- [x] `tests/portable-win-layout.test.cjs` pins the branding fields and that win32 is wired
- [x] Proven on a real PE — version block read back, all 7 PNG-payload ICO entries found in the
      binary, shell-extracted icon is the Studio logo. Caught the kebab-case key trap that made
      the first pass exit 0 while the exe still said "Electron" (`validation.md` § 3)
- [x] `npm test` green — 1344 pass, 0 fail
- [x] Phase 2.5 (`dev:rebrand` on `node_modules/electron/dist/electron.exe`) — DROPPED on Fabio's
      call: the taskbar is never on screen in the tutorials
- [x] The pin-and-reopen cycle handed to the 2.0 pre-release testing, written into
      `docs/releases/github-release-checklist.md` § "Windows: pin to the taskbar, close, reopen"
