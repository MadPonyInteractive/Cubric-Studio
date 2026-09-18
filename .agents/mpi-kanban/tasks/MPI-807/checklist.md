# MPI-807 checklist — Windows exe PE rebrand

- [ ] `@electron/rcedit` added as a devDependency (bundles `rcedit.exe`; the win32 artifact
      is built on `windows-latest` in mpi-ci, so no wine path is needed)
- [ ] `scripts/build-portable.mjs` runs rcedit on the STAGED `CubricStudio.exe` only, after the
      `electron.exe` -> `config.exeName` copy. Never on `node_modules`.
- [ ] Fields written: icon `media/icons/cubric-vision.ico`, `FileDescription`, `ProductName`,
      `CompanyName`, `InternalName`, `OriginalFilename`, `LegalCopyright`,
      `ProductVersion`/`FileVersion` from `package.json`
- [ ] Failure is LOUD — an unbranded exe is the defect this card exists for, so the build throws
- [ ] `tests/portable-win-layout.test.cjs` pins the branding fields and that win32 is wired
- [ ] Proven on a real PE: run the branding pass on a staged copy of `electron.exe`, read the
      version block back and confirm the icon group changed (PNG-payload ICO entries accepted)
- [ ] `npm test` green
- [ ] Phase 2.5 (`dev:rebrand` on `node_modules/electron/dist/electron.exe`) — only if Fabio wants it

## Not covered here

The pin-and-reopen cycle on a second Windows box (brief § Verification step 2) needs a released
artifact and a machine that is not this one. Recorded in `validation.md` as the one open check.
