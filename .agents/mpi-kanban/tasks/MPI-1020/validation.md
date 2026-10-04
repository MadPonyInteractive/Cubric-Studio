# MPI-1020 validation

- Seven screenshots taken from the docs site (`Cubric Studio (Docs)/assets/docs/`), all showing the 2.0 "Cubric Studio" title bar, converted to 1600px WebP (650 KB total). The seven 1.x README images (7.7 MB) were removed; nothing else in the repo referenced them.
- Copy refreshed from `docs/releases/2026-10-04-v2.0.0.md`: Flows, the in-app agent and routines, sound and speech, cloud models on a DeepInfra key, GIFs, big photos, Remote only, Smart App Control and Xcode Command Line Tools notes. No em dashes (`grep -c` = 0).
- Links: `cubric.studio/vision/` and every `docs.cubric.studio/vision/...` path redirect now, so they point at the root pages. All 16 docs URLs returned HTTP 200 on 2026-10-05.
- Every image path in README.md resolves to a file on disk, and all seven images load on the live GitHub repo page (1600x860 each, checked in the browser pane).
- CI: Tests run 37243493305 on `11f83c34` (the reopen on top of `02d8d622`) passed.
- Fabio kept the old "Video generation" clip on purpose: the UI screenshots were what needed updating.
