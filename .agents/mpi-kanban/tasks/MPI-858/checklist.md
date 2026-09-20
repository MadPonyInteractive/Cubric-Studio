# MPI-858 — checklist

- [ ] The frame's own alpha is the CEILING in `applyMaskAlpha` - after adjust, fill holes and invert
- [ ] A previously-transparent pixel can never come back opaque (no resurrected black)
- [ ] `tests/gif-cutout.test.cjs` covers it, and is red without the fix
- [ ] The existing mask-to-alpha / adjust / invert tests stay green (an opaque frame is unchanged)
- [ ] `docs/masking-sam3-gif.md` records the ceiling and why
