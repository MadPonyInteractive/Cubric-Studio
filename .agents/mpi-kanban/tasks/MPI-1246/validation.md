# MPI-1246 validation

- Offline: each 1240x516 scene placed at its new `landing.css` geometry overlaps screwdriver's at IoU 0.98, top/bottom edges within 1-2 px.
- Headless Chromium: the `[src$="/connecting-screwdriver.webm"]` override applies when JS sets `video.src` (538 / 520 / 538 px).
- Pre-push lint + unit tests green on 90019619f.
- Fabio, 2026-10-22, on a real pod connect: all four connecting scenes line up.
