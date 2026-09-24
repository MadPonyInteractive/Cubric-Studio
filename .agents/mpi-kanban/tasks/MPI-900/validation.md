# MPI-900 validation

## 2026-09-24 - Klein 9B only, one pass, paste-back (session c3d96049)

- `node scripts/validate-injection-rules.mjs comfy_workflows/flow_outpaint.json` -> conforms.
- raw -> API via `scripts/workflow-to-api.mjs` (engine :48188 object_info): every surviving node identical to the previous runtime graph except 112 (bake), 667 (delimiter), 685 (regex), 493 (reads 686).
- Targeted: connector-agent-tools, flow-model-choice, inject-params-titles, flow-enhance-ownership, outpaint-passes, agent-outpaint-frame, agent-cards -> 97/97 pass.
- `npm test` -> 1834 pass, 0 fail. eslint on the three touched js files -> clean.
- NOT yet verified: a real generation. Needs Fabio's eyes (user-ux): original pixels unchanged, no seam, alpha of the staged PNG is 0 in the new area.
