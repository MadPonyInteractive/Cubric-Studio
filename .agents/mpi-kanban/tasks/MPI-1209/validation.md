# MPI-1209 validation

- Cause found 2026-10-20: `Start Menu\Programs\Cubric Studio.lnk` (target a deleted `D:\CVTest\...\CubricStudio.exe`) and `Electron.lnk` (target `node_modules\electron\dist\electron.exe`) both carried AUMID `cubric.studio.vision`, the ID every run set. Windows gave the dev window the dead shortcut's target and icon.
- Fix: `main.js` sets `cubric.studio.vision.dev` when `!app.isPackaged`. Packaged/portable builds keep `cubric.studio.vision`; the portable path already depends on `app.isPackaged` being true (`resolveMainPortableRoot`).
- `node --check main.js` passes.
- Not yet eye-tested: after `npm start`, right-click the taskbar button -> Properties should no longer show the old D:\CVTest path.
