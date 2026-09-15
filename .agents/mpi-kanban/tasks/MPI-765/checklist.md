# MPI-765 Checklist

- [x] Model branch of the agent submit accepts `media: [{role, url}]`, resolved through the op's declared slots (same as the Flow path)
- [x] Required slot empty = `MEDIA_REQUIRED` by name, checked BY ROLE (found live); unknown role / missing url / duplicate role = `BAD_REQUEST`
- [x] Mask-only ops (`requiresMask`) refused by name, not a bare CANCELLED
- [x] Route relays `media` on the modelId branch; no-media input shape unchanged
- [x] Unit tests for the resolver + route relay; connector suites 40/40, npm test 1045/1045, order test proven to bite
- [x] Live: `klein-9b` `kleinEdit` with two staged images landed a real card (`edit_002.png`, 8:5, sidecar roles in slot order)
- [x] Skill `generating.md` documents the media contract; `MEDIA_UNSUPPORTED` row retired; SKILL.md description names reference images
