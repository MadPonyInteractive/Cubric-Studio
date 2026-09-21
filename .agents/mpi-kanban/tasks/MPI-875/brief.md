# MPI-875 — A cloud run can land twice, and the agent reaches for a paid model unprompted

Two bugs, both found live on 2026-09-21 and both about spending the user's money without
being asked. Reported by the MPI-870 session, diagnosed here, and independently re-verified
by that session against the same files.

## 1 — one call, two cards

Fabio asked the in-app agent for one t2i. It chose `nano-banana-2-cloud` and the project
`Anime Kids and Dog` came back with `t2i_001.png` AND `t2i_002.png`.

**It was ONE dispatch and ONE bill.** The evidence, all on disk:

| Fact | Where |
|---|---|
| Both groups share `createdAt` `2026-09-21T11:03:11.161Z`, equal to the millisecond | `project.json` |
| Both sidecars carry the SAME cost object — `usd 0.067257`, `at 11:03:10.579Z` | `Media/.meta/*.json` → `generationSettings.cost` |
| $0.067 is DeepInfra's published rate for ONE 1K image from this model | `dev_configs/deepinfra-prices.json` |
| One `[generationService] card registered` line, which logs once per call with a `groups: N` count | `app.log` 11:03:11.166Z |
| One `generation.submit`, one `agent named params` line, no second describe | `app.log` 11:02:58 |

So the upstream response carried **two entries in `images`**. `routes/deepinfra.js:206-210`
writes one scratch file and one viewUrl per entry, and `generationService.js:1269` builds
one card per output URL. Two URLs, two cards, one charge. The 290 ms between the two file
writes is that save loop, not a second render.

The two files differ in bytes and match in pixels: concatenated IDAT is byte-identical and
only Google's `caBX` C2PA manifest differs, because a fresh `urn:c2pa:` uuid is minted per
DELIVERY. One generation, delivered twice, signed twice. A hash comparison alone points the
wrong way here — that is the tell.

**Intermittent, not per-model.** `nano-banana-2-cloud` at `10:05:00.639Z` the same morning
produced exactly one card. Six cloud cards exist on this box and only this run doubled.
Fabio's hint is worth keeping: *"some DeepInfra generations are extremely fast"* — this one
was a ~12 s round trip.

### What ships

`POST /deepinfra/generate` honours the count it asked for. Its own header already promises
"N outputs, ONE call, ONE bill"; it currently forwards however many the provider hands back.
Keep the first `batch`, drop the rest, and `logger.warn` with BOTH counts — **counts only,
never the body**, per the file header's rule about upstream bodies.

This is the right layer: the count is decided in this route (`buildSizeFields`), so the
route is where the promise is kept. `generationService`'s per-url loop is correct as it is
and belongs to a live peer's claim — do not touch it.

### Downstream, and it is NOT fixed by the clamp

Both duplicate sidecars carry the **full** `0.067257`. Anything that sums cost per card
over-counts by exactly the duplication rate. **[[MPI-855]]'s spend readout must sum per
CALL, not per sidecar**, or it will over-report the moment this happens once. Recorded here
because the two cards on disk are already wrong and the clamp cannot retro-fix them.

## 2 — a billed model as an unprompted default

The same run: the agent picked a paid cloud model for a plain t2i, with no instruction to
spend anything.

`js/data/modelConstants/modelPriority.js` lists no cloud model anywhere — not in
`IMAGE_ORDER`, `EDIT`, `T2V` or `I2V` — so `opPriority()` returns `null` for all fifteen,
while `krea2` is rank 1 for t2i. The agent reads rank and note through
`GET /connector/models`, and **`rank: null` reads as "unranked", not as "avoid"**. Nothing
in its catalogue says this one costs real money. MPI-865 gave the human picker a cloud
badge; the agent surface got no equivalent.

### What ships

Cloud ops rank **after every local model** for the same task, and each carries a note that
names the price. Both halves, not either: the rank stops it being reached for first, the
note is what lets the agent say what it would cost if a user asks for one on purpose.

- The price comes from `estimateCost()` (`deepinfraPricing.js`), never a number typed here —
  the snapshot is the one source, and a hand-written price drifts silently.
- Keep the local lists untouched. Append the cloud entries after the locals are ranked, so
  adding a local model still reorders nothing.
- The `-nsfw` exclusion rule in that file's header is about an agent drifting somewhere it
  was not sent. The same reasoning applies to a billed model: the note must say the cost in
  the user's terms.

## Verify

- A response carrying more images than were asked for produces exactly `batch` cards, and
  the extra is logged with both counts and no body.
- `opPriority()` returns a rank for every cloud op, below the last local model for that
  task, with a note naming the price.
- `npm test` green, `npm run lint:components` green.
- Fabio's own check is the one that matters for half 2: an unprompted agent t2i must reach
  for a local model.

Related: [[MPI-855]] (the per-call ledger), [[MPI-851]] (the cloud executor this route
shipped with), [[MPI-865]] (the human picker's cloud badge).
