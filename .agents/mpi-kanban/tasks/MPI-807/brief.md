# Windows exe PE rebrand — Phase 2.4 of the portable plan, never built

Raised 2026-09-18 out of MPI-708 Phase 2b, when the icon set was regenerated for the
Cubric Studio rename and the Windows half turned out to have no consumer at all.

## What is actually wired today

| Surface | Source | State |
|---|---|---|
| macOS dock / Finder | `build/icon.icns` copied over `Contents/Resources/electron.icns` (`scripts/build-portable.mjs:719`) | works |
| Linux dock / taskbar | `media/icons/cubric-vision.png` + the per-user `.desktop` with `StartupWMClass` (`scripts/portable/linux/setup-desktop.sh`) | works |
| Windows, running window's taskbar button | `BrowserWindow({ icon: favicon.png })` (`main.js:433`) | works |
| **Windows, .exe PE resource — Explorer, and any pinned shortcut** | **nothing** | **missing** |

`media/icons/cubric-vision.ico` is staged to `resources/icons/` by
`scripts/build-portable.mjs:450` and is then read by no code on any platform. Grepping the
repo for `.ico` consumers returns zero hits outside archived plans.

## Why it matters, in Fabio's own words

From MPI-11 (asked 2026-05-25, diagnosed the same day, never fixed):

> I tried to add it to the taskbar quick items, and it defaulted back to the ElectronJS logo.

Windows reads the taskbar icon from the **process binary's PE resource** when grouping by
AppUserModelID, and from the target binary for any pinned shortcut. `app.setAppUserModelId`
is already set (`main.js:240` `cubric.studio.vision`) and the AUMID alone does not fix the
icon. `scripts/build-portable.mjs:505,529` copies `electron.exe` to `CubricStudio.exe`
byte-for-byte, so the copy inherits Electron's icon, `FileDescription`, `ProductName` and
`OriginalFilename`.

The same missing step is why a dev run always shows the Electron logo: `npm run dev` executes
`node_modules/electron/dist/electron.exe` directly. Phase 2.5 below is the dev-side answer, and
is optional.

## Scope

1. **rcedit on the STAGED copy, never on `node_modules`.** Add `rcedit` as a devDependency and
   run it in the Windows branch of `scripts/build-portable.mjs`, after the `electron.exe` ->
   `config.exeName` copy, against the staged file only. The original plan's field list:
   - Icon -> `media/icons/cubric-vision.ico` (this finally gives the file a consumer)
   - `FileDescription`, `ProductName` -> `Cubric Studio`
   - `CompanyName` -> `MadPony Interactive`
   - `InternalName`, `OriginalFilename` -> `CubricStudio`, `CubricStudio.exe`
   - `LegalCopyright` -> MadPony Interactive
   - `ProductVersion` / `FileVersion` -> from `package.json`
2. **Phase 2.5 (optional):** an `npm run dev:rebrand` that runs the same pass on
   `node_modules/electron/dist/electron.exe`, for tutorial recording. It edits an installed
   dependency, so it must be opt-in and must survive `npm ci` wiping it.
3. **Check `.ico` freshness at the same time.** `media/icons/cubric-vision.ico` was regenerated
   from the Studio logo on 2026-09-18 (MPI-708): 7 entries, 16/24/32/48/64/128/256, PNG payloads.
   Whatever rcedit build is used must accept PNG-payload ICO entries, or the file needs BMP
   entries at the small sizes instead.

## Verification

Only a real Windows artifact proves it — a dev run cannot, by definition.

1. `npm run build:portable` for win32, then check the staged `CubricStudio.exe` properties:
   Explorer shows the Studio icon, and Details shows the rebranded fields.
2. On a box that is not this one: extract the portable, launch, **pin to taskbar**, close and
   reopen. The pinned icon must stay Studio. That pin-and-reopen cycle is the exact case MPI-11
   reported, and the only one that fails today.

## Do not confuse this with

- The icon FILES, which are correct and current — MPI-708 regenerated all of them and parsed
  each container back entry by entry.
- The running app's taskbar button on Windows, which already shows our icon via `favicon.png`.
  A check that only launches the app will pass while this card's defect is still present.
