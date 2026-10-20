# MPI-1209 validation

- Cause found 2026-10-20: `Start Menu\Programs\Cubric Studio.lnk` (target a deleted `D:\CVTest\...\CubricStudio.exe`) and `Electron.lnk` (target `node_modules\electron\dist\electron.exe`) both carried AUMID `cubric.studio.vision`, the ID every run set. Windows gave the dev window the dead shortcut's target and icon.
- Fix: `main.js` sets `cubric.studio.vision.dev` when `!app.isPackaged`. Packaged/portable builds keep `cubric.studio.vision`; the portable path already depends on `app.isPackaged` being true (`resolveMainPortableRoot`).
- `node --check main.js` passes.
- Eye test PASSED by Fabio 2026-10-20: `npm start` taskbar button Properties now show `node_modules\electron\dist\electron.exe`; Cubric icon kept.
- CI run 39354922025 green on 5c4e8e0a8.
