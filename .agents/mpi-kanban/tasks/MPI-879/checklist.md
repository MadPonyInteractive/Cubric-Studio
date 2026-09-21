# MPI-879 - checklist

- [ ] `duration` in `js/components/Organisms/MpiPromptBox/PromptBoxControls.js` takes its
      bounds from the picked model instead of the hardcoded `1..30`: cloud model
      (`provider` + `cloud.endpointId`) -> `durationRangeFor(endpointId)`; anything else,
      and any cloud model publishing no duration range, keeps `1..30`.
- [ ] The bounds are applied in all four places the old constants appear in that entry:
      the saved-value clamp at mount, `MpiProgressBar`'s `min`/`max`, the `input` label
      clamp and the `change` clamp.
- [ ] A saved value from another model survives the switch - a project holding 30 from a
      local model opens Seedance 1.5 at 12, not 30, because the clamp reads the range.
- [ ] `getInjectionParams` still clamps. It has no `opts`, so it reads the bounds the
      mount stored and falls back to `1..30` when called off a spread copy (the shape
      `tests/control-snapshot-injection.test.cjs` uses).
- [ ] Guard in `tests/cloud-duration-bounds.test.cjs`: the bounds helper returns each
      shipped cloud video model's published range (Seedance 1.5 4-12, Seedance 2.0 4-15,
      Wan 3.0 2-30), `1..30` for a local video model and for Veo 3.1, and the
      out-of-range saved value clamps into the range.
- [ ] `npm test` for the new file plus the three suites that read this control:
      `control-snapshot-injection`, `inject-params-titles`, `cloud-price-tag`.

## Out of scope

- Veo 3.1 publishes no `duration` field at all, so its slider changes nothing whatever
  range it shows. That is a second defect (a control that should not mount) and needs its
  own card - this one only stops the slider offering lengths the provider will refuse.
