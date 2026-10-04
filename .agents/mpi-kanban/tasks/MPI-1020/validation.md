# MPI-1020 validation

- Seven screenshots taken from the docs site (`Cubric Studio (Docs)/assets/docs/`), all showing the 2.0 "Cubric Studio" title bar, converted to 1600px WebP (650 KB total). The seven 1.x README images (7.7 MB) were removed; nothing else in the repo referenced them.
- Copy refreshed from `docs/releases/2026-10-04-v2.0.0.md`: Flows, the in-app agent and routines, sound and speech, cloud models on a DeepInfra key, GIFs, big photos, Remote only, Smart App Control and Xcode Command Line Tools notes. No em dashes (`grep -c` = 0).
- Links: `cubric.studio/vision/` and every `docs.cubric.studio/vision/...` path redirect now, so they point at the root pages. All 16 docs URLs returned HTTP 200 on 2026-10-05.
- Every image path in README.md resolves to a file on disk.
