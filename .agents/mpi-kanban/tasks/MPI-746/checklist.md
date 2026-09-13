# MPI-746 checklist

- [x] Raw sources: KSamplerSelect 24/112/171 (template) and 188 (three Flows) -> `lcm`; UltimateSDUpscale 405 and MaskDetailerPipe 415 -> `lcm` + `normal`
- [x] Convert raw -> API against 48188; diff shows `sampler_name` / `scheduler` only
- [x] Regenerate `klein_t2i.json` + `klein_9b_t2i.json` with `generate_klein.py`
- [x] `validate-injection-rules.mjs`, `verify-workflow.mjs`, `tests/inject-params-titles.test.cjs` green
- [x] Docs: `docs/models/klein/README.md` (Chain + Shipped config); `removal.md` left alone (history)
- [x] LanPaint 652: no `lcm` in its list -> `euler_ancestral`/`simple` on Fabio's bench verdict; re-converted, regenerated, checks re-run; Klein cell in `docs/models/lanpaint-inpaint.md` fixed
