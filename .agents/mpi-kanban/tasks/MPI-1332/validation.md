# MPI-1332 validation

- npm test: 3802 tests, 3800 pass, 0 fail (2 skipped), 2026-10-29.
- npm run lint: clean.
- tests/agent-loop.test.cjs: un-named Krea 2 with Klein 9B installed -> INSTALLED_FITS, no card; 'Make it with Krea' -> card.
- tests/model-priority.test.cjs: t2i order Krea 2, Qwen-Image 2.1, FLUX.3 Klein, Klein 9B, Chroma Flash/Hyper, Klein 4B, SDXL.
- Commit 1ac291f37 pushed.
- Not checked live in the app: Cosmo's next pick on the real chat.
