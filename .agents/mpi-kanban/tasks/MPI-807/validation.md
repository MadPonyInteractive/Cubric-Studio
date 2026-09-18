# MPI-807 validation — Windows exe PE rebrand

Measured 2026-09-18 on this box (Windows 11 Pro, `node scripts/build-portable.mjs`).

## What shipped

`scripts/build-portable.mjs` — `brandWindowsExe()` runs `rcedit` on the STAGED
`CubricStudio.exe`, immediately after `stageElectronRoot()` copies `electron.exe` over it.
`node_modules/electron/dist/electron.exe` is never touched. `rcedit@5` is a devDependency.
`windowsExeBranding(exeName)` holds the field values and is exported so a test can pin them.

## 1. A real staging run brands the shipped binary

`node scripts/build-portable.mjs --clean --platform win32 --arch x64 --stage-dir D:/tmp/mpi807-stage --no-source-manifest`

`(Get-Item …\CubricStudio-windows-x64-v1.6.1\CubricStudio.exe).VersionInfo`:

| Field | Before (unbranded copy) | After |
| --- | --- | --- |
| FileDescription | Electron | **Cubric Studio** |
| ProductName | Electron | **Cubric Studio** |
| CompanyName | GitHub, Inc. | **MadPony Interactive** |
| InternalName | electron.exe | **CubricStudio** |
| OriginalFilename | electron.exe | **CubricStudio.exe** |
| LegalCopyright | Copyright (C) 2015 GitHub, Inc. | **© MadPony Interactive** |
| FileVersion / ProductVersion | 41.1.1 (Electron's) | **1.6.1** (from package.json) |

`©` survives the rcedit command-line boundary: the PE holds `a9 00` UTF-16LE before
`MadPony Interactive` (the terminal's own rendering of it is mojibake, the bytes are not).

`[System.Drawing.Icon]::ExtractAssociatedIcon` on the staged exe returns the Studio logo;
the same call on the untouched `node_modules` `electron.exe` still returns the Electron atom.

The build ran to exit 0 (one expected warning: no `--from-manifest`, so a full update bundle).
Both checks were then repeated on `CubricStudio.exe` **extracted back out of the shipped
`CubricStudio-windows-x64-v1.6.1.zip`** — same fields, same icon — so what a user downloads
carries the branding, not just the stage dir. Stage and zips deleted afterwards.

## 2. The PNG-payload ICO is accepted (brief § 3)

All 7 entries of `media/icons/cubric-vision.ico` (16/24/32/48/64/128/256, PNG payloads) are
present byte-for-byte in the branded exe and absent from the unbranded copy — rcedit copies
icon payloads verbatim into `RT_ICON`, so no BMP-entry rebuild is needed.

## 3. The trap this nearly shipped with

The first pass used rcedit's kebab-case casing (`file-description`, `product-name`, …) for the
`version-string` keys. rcedit writes keys VERBATIM, so it wrote entries Windows never reads:
**the build exited 0, the icon changed, and the exe still said "Electron"**. Only reading the
version block back caught it. Keys are now the MSDN StringFileInfo names, and
`tests/portable-win-layout.test.cjs` rejects a kebab-case key.

## 4. Tests

`npm test` — 1344 pass, 0 fail, 1 skipped (pre-existing). Two new tests in
`tests/portable-win-layout.test.cjs`: the branding field values + key casing, and that the
rebrand targets `path.join(stageRoot, config.exeName)` with the `.ico` as its only consumer.

## The pin cycle moved to the 2.0 release gate — it did NOT lapse

Brief § Verification step 2 (extract on a box that is not this one, **pin, close, reopen**) is
the one check no agent can run: Windows 11 has no scriptable pin verb, and this box's shell icon
cache already holds entries for these paths. Fabio's call, 2026-09-18: it happens with the rest
of the pre-release testing for 2.0, rather than renting a box now for one right-click.

So it is written into the gate instead of left on a card — `docs/releases/github-release-checklist.md`
§ "Windows: pin to the taskbar, close, reopen". The card closes on the evidence above; the pin
cycle is the release's job, and the checklist says why a launch-only check does not cover it.

## Not done (deliberate)

Phase 2.5 — `npm run dev:rebrand` over `node_modules/electron/dist/electron.exe`, so a dev run
shows the Studio icon while recording. **Dropped on Fabio's call, 2026-09-18: the taskbar is not
on screen in the tutorials, so the only thing it would fix is never filmed.** Do not re-raise it;
the exe that ships is branded, which is the part that was ever visible to a user.
