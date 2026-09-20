# MPI-831 Validation

**Verify mode:** `user-ux` — every phase is a visual judgement in the app. The check runs in
an isolated instance (`npm run app:isolated`, own profile + own port + `APP_DOCUMENTS`),
never the user's live `:3000`.

## Phases 1 and 2 — VERIFIED 2026-09-20

**Fabio's own check, in the app:** approved. He raised one gap against phase 1 (a flat
section leaves no way to read a tile's media type), which phase 2 then closed as a media
badge rather than the planned source badge; he approved that too.

**Seed:** two valid packages in the agent profile, `seed-image-flow` and `seed-audio-flow`.
The audio one is the load-bearing half — it is what proves a package leaves its media
section.

| Check | Command / method | Result |
|---|---|---|
| Section renders, both media types | live DOM, isolated instance | `Image 5 · Video 3 · Audio 5 · Third-party Flows 2` |
| Audio package absent from Audio | same | Audio holds only the 5 built-ins |
| No packages → unchanged grid | packages removed, reload | `Image 5 · Video 3 · Audio 5`, no header |
| Media flags on package tiles only | live DOM, all tiles | `mediaAudio` + `mediaImage` on the two; nothing elsewhere |
| Shared primitive's other 3 surfaces | opt-in keys, none set | untouched by construction |
| Lint | `npx eslint` on both changed files | clean |
| Unit tests | `node --test tests/user-flows.test.cjs` | 14/14 |

**Not yet done:** phases 3 and 4. The card stays in `doing`.
