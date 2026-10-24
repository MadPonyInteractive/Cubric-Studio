# MPI-1278 validation

What steered Cosmo to turbo off on FLUX.3 Klein, and what it reads now:

| Place | Before | Now |
|---|---|---|
| `docs/agent/models/flux-3.md` § Settings (`guide:flux-3`, gated: read before every FLUX.3 generate) | "Base is the one for photoreal people"; "better quality" = `turbo: false` | Auto sends `turbo: true`, people and photographs included; `turbo: false` only when the user asks (more quality, natural skin, final pass, base, turbo off); Ask first offers Turbo as the default |
| same guide, "When a result disappoints" | "Plastic skin: Rerun with `turbo: false`" | offer the rerun (about 4x slower), run it on a yes |
| `modelPriority.js` NOTES (`list_models` note on `t2i`/`i2i`/...) | "photographs and skin with turbo: false" | "Start on Turbo ... turbo: false only when the user asks for more quality" |

Already right, untouched: the system prompt's Auto line ("For images: use turbo: true"),
the app default (`krea2Turbo: true` in `promptControlDefaults.js`), the `edit` op note.

Evidence:
- `tests/flux3-turbo-first.test.cjs` pins both texts (3 tests, pass).
- `npm run lint` and `npm test`: see the commit.

Not run: the agent bench (`npm run agent:test`). Its captured models fixture has no
`flux3-klein`, and every run is a paid DeepInfra or local-GPU LLM call.
