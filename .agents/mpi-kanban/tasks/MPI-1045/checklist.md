# MPI-1045 checklist

- [x] Audit every plugin call site, toast or not (`research/audit.md`)
- [x] `qwen3vl-abliterated-clip` is an engineAsset
- [x] `image-describer` entry gone from pluginsRegistry.js
- [x] Every plugin check removed: describeImage, describeAction, MpiLlmSettings
- [x] Cue line for a describe job still names it
- [x] Comments, docs, skill, rule updated (rule edit OK'd by Fabio 2026-10-08)
- [x] Tests re-targeted and passing 
