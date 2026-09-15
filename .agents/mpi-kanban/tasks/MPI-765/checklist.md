# MPI-765 Checklist

- [x] Model branch of the agent submit accepts `media: [{role, url}]`, resolved through the op's declared slots (same as the Flow path)
- [x] Required slot empty = `MEDIA_REQUIRED` by name; unknown role / missing url / duplicate role = `BAD_REQUEST`
- [x] Mask-only ops (`requiresMask`) refused by name, not a bare CANCELLED
- [x] Route relays `media` on the modelId branch; no-media input shape unchanged
- [x] Unit test for the resolver + route relay; connector suites green (39/39), npm test 1044/1044, order test proven to bite
- [ ] Live: `klein-9b` `kleinEdit` with two staged images lands a real card (needs the user's app RESTARTED: `routes/connector.js` is server-side)
- [x] Skill `generating.md` documents the media contract; `MEDIA_UNSUPPORTED` row retired; SKILL.md description names reference images
