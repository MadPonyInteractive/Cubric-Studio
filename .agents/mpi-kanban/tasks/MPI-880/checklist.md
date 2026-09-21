# MPI-880 — checklist

Decision, Fabio 2026-09-21: do NOT fix the slider for a fixed-length model. Render a
static line instead. No `MpiProgressBar` mount, so the `min === max` NaN maths the card
warned about is never reached.

- [ ] `fixedDurationFor(endpointId)` exported from `deepinfraPricing.js` — the 8 stays a
      single source (`CLIP_SECONDS`), never retyped in the control.
- [ ] `durationBoundsFor` returns `{min: 8, max: 8}` for a fixed-length model.
- [ ] The duration control renders the label row only for that model — no slider, no
      wheel, no drag.
- [ ] Pricing stops trusting a supplied duration for a fixed-length model: `CLIP_SECONDS`
      WINS over `opts.duration` at both `priceTokenVideo` and `priceOutputLength`. This is
      the money half — the UI is not the only writer of `Input_Duration`
      (`generationControls.js:484` is the agent path).
- [ ] Tests: veo bounds are 8..8, a 30 supplied from anywhere prices at 8, and the source
      seam holds (no slider mounted for a fixed model).
- [ ] `node --test tests/cloud-duration-bounds.test.cjs tests/deepinfra-pricing.test.cjs`
      green, and `tests/cloud-price-tag.test.cjs` still green (MPI-852's file, read only).
