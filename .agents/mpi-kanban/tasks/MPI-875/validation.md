# MPI-875 — validation

## 1 — the clamp, `routes/deepinfra.js`

`POST /deepinfra/generate` now keeps the first `wanted` outputs, where `wanted` is the same
count `buildSizeFields` was given, and `logger.warn`s with BOTH counts when the provider
hands back more. Counts only — no upstream body, per the file header's rule.

**Proven RED on pre-fix code, not just green on fixed.** With `images.slice(0, wanted)`
swapped back to `images`, the new test fails and nothing else does:

```
✖ an OVER-DELIVERY is clamped to the count asked for (MPI-875)
ℹ pass 21   ℹ fail 1
```

Restored, the same file is 22/22, and the warn line reads:

```
[WARN] [system] deepinfra generate: flux-schnell-cloud returned 2 outputs for 1 asked; keeping 1
```

The test lives in `tests/cloud-executor.test.cjs` rather than a new file because that file
already owns the route harness (`routeServer`, `post`) and the stubbed provider. Nothing in
it makes a real DeepInfra call: the key is a fake in `DEEPINFRA_API_KEY`, restored after,
and the upstream is stubbed. The test also asserts `cost.usd` is the single call's
`0.067257` — the reason the extra card is wrong rather than untidy.

## 2 — the ranking, `js/data/modelConstants/modelPriority.js`

Every cloud op now ranks after the last local model for its task and carries a note that
names the price, read from `estimateCost()` — never typed. What the agent reads through
`GET /connector/models` today:

| op | rank | note |
|---|---|---|
| `krea2:t2i` | 1 | (unchanged) |
| `sdxl-realistic:t2i` | 6 | (unchanged) |
| `flux-schnell-cloud:t2i` | 10 | PAID … about $0.0005 an image |
| `nano-banana-2-cloud:t2i` | 18 | PAID … about $0.07 an image |
| `seedream-4-cloud:edit` | 7 | PAID … about $0.04 an image |
| `veo-31-cloud:t2v` | 9 | PAID … about $2.00 a clip |

Two tests pin it: every paid op ranks strictly below every local op for the same task and
its note matches `/^PAID: /` and `/about \$\d/`, and the locals' own ranks are unmoved
(`krea2:t2i` 1, `boogu-edit-high:edit` 1, `minimax-h3:t2v_ms` 1).

## Checks

- `npm test` — **1710 tests, 1708 pass, 0 fail, 1 todo.** The todo is MPI-867's declared
  one in `agent-video-attachment.test.cjs`, red on purpose and not a regression. Baseline
  before this card was 1707/1705/0/1, so the three new tests are the whole difference.
- `npm run lint:components` — clean.
- `npx eslint` on all four changed files — clean.

## Still owed: Fabio's eyes on half 2

The rank and the note are what the agent READS; whether it then behaves is a judgement only
a live run shows. **Verify mode is `user-ux` for that half.** The check: ask the in-app
agent for a plain image with no model named, and it must reach for a local model. Asking for
a cloud model by name must still work, and the agent should be able to say what it costs.

Half 1 needs no live check — it is provider behaviour that cannot be summoned on demand
(it happened once in six cloud runs), which is exactly why it is pinned by a test instead.

## Cross-check worth keeping: the estimator against a REAL bill

Run by the MPI-876 session on 2026-09-21, against the very charge this card investigated:

```
estimateCost('google/nano-banana-2', { width: 1376, height: 768 })
  -> { usd: 0.067296, display: 'about $0.07', checkedOn: '2026-09-20' }
```

The sidecar of Fabio's duplicated run carries `generationSettings.cost.usd = 0.067257` for
that exact model and size — DeepInfra's own figure for the call. The estimate is **0.06%
high**, which is the direction Fabio asked for ("approximately", over rather than under).
So the note this card puts in front of the agent quotes a figure that holds up against the
provider's own dashboard.

Also confirmed there: `{ batch: 6 }` returns `usd 0.403776` / `about $0.40`, an unknown
endpoint id returns null, and `require()` reaches the ESM module from CJS on Node 24.
