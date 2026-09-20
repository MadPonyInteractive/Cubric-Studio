# MPI-860 Brief

**Status: idea. Research done 2026-09-20, ToS read, NOTHING built and NO tests run.**
Parked deliberately — the paid-model surface is going out through DeepInfra first (MPI-849).
Pick this up when someone asks "can we have MiniMax in the app".

## Why this card exists

Local MiniMax H3 tears. A month of attempts did not fix it, and the reason is now written
down: H3's VAE compresses time as `1 + 4 + 4 + 4 + 4` — five latent frames per seventeen real
ones (see [MPI-707](../MPI-707/brief.md)). Fast motion inside a four-frame group is **averaged**.
That is the smearing / tearing / vanishing-limbs failure.

It is a TEMPORAL artefact. More canvas cannot fix it, which is why the local `2k` and `4k`
tiers do not help and why a spatial upscale only sharpens the smear.

`js/utils/ratios.js` already carried the answer and nobody had joined it up:

> H3-Regenerate-2K, the 768p->2K SECOND PASS, is **API-only and NOT in the open weights** —
> local is H3-Base at 768p.

We have been buying resolution. We have never had the second pass.

## The finding

MiniMax's v2 regeneration endpoint takes **two** input forms:

| Input | Constraint |
|---|---|
| `source_task_id` | their own task, 7-day window, whitelist |
| `base_video` | **public URL, `mm_file://{file_id}`, or base64 data URI** |

`base_video` is an arbitrary upload. Our clip qualifies as input. **No weights, no GPU and no
ComfyUI are needed to make the call** — it is upload, poll, download.

### The input contract, and why our output already meets it

| Their `base_video` rule | Our H3 output |
|---|---|
| 24 fps | `H3_FPS = 24` (`js/data/generationControls.js`) |
| audio required | H3 emits stereo audio |
| area 589,824–1,032,192 px | native ladder floor `768x768` = 589,824; cap `1344x768` = 1,032,192 |
| both axes /32 | whole ladder is /32 |
| 107–362 frames, step 17 | `snapH3Frames`, `n % 17 == 5`, `H3_TRAINED_MAX = 362` |

Their window **is** H3's native canvas, floor and cap to the pixel. No conform, no re-encode.

**Which tiers are regen-eligible** (from `MINIMAX_H3_RATIOS`):

| Tier | 1:1 | 9:16 / 16:9 | 21:9 |
|---|---|---|---|
| `very_low` | 200,704 no | 372,736 no | 458,752 no |
| `low` | 409,600 no | 737,280 yes | 774,144 yes |
| **`medium`** (native) | **589,824 yes** | **1,032,192 yes** | 983,040 yes |
| `high` | 921,600 yes | 1,597,440 no | 1,376,256 no |
| `very_high` / `2k` / `4k` | no | no | no |

Load-bearing for any future ladder rework: a cheap draft tier must stay >= 589,824 px or it
cannot be finished in the cloud.

### Price (official paygo, read 2026-09-20)

| | |
|---|---|
| H3 768P generate | $0.08 / output second |
| H3 2K generate | $0.13 / output second |
| **768P -> 2K regeneration** | **$0.05 / output second** |

$0.08 + $0.05 = $0.13, the direct 2K rate to the cent. So regen saves nothing when you also
paid for the draft — it saves everything when the draft is free on the user's own GPU.
5s clip = $0.25. 10s = $0.50.

## The one thing NOT verified

Regen is **in-context re-diffusion by H3 itself**, not a super-resolution module — MiniMax's
own description. Promising for artefacts.

But nobody documents motion-artefact repair, and the **frame budget is unchanged** (same
17-step grid), so the temporal compression structure is identical. It may re-decide the
smeared spans; it may faithfully reprint them at 2K.

**Unknown. Nothing else on this card matters until it is measured.**

## Test plan (not run — needs Fabio's key and account)

~$1.50 total.

| # | Test | Cost | Decides |
|---|---|---|---|
| T1 | Regen a clip known to tear (MPI-591 bench footage) | $0.25 | Everything: does re-diffusion fix temporal smear |
| T2 | Same shot at `low` 16:9 vs `medium` native, both regenned | $0.50 | Is the cheap draft tier viable, or is native the floor |
| T3 | Conform an LTX/Wan clip to spec, regen it | $0.25 | Spec-checked or provenance-checked — decides the generic-finisher option |
| T4 | Cloud 2K direct vs local draft + regen, same prompt | $0.50 | Does the money-saver cost quality |

Pre-req: confirm our written mp4 actually carries the audio track. A silent file is rejected
and will read as an API bug.

## Shape, if the tests pass

Fabio's call on 2026-09-20: **both** cloud generation and finish-only, with local/RunPod
drafting kept.

**Do NOT model the finisher as a cloud ModelDef.** It is a card-level op like `upscale`: takes
a source card, returns a card. No ModelDef discriminator, no install-gate branches, no weights
requirement — a user with zero H3 on disk can still use it. That dodges nearly all of
`docs/proprietary-models-research/00-cubric-vision-integration-points.md`.

Full cloud generation DOES need that whole sweep (ModelDef discriminator, the five install-gate
branches, executor split, progress adapter). Build the finisher first; its upload/poll/download
adapter is ~90% of the generation transport.

BYO key is the third instance of a shipped pattern (`main/secretsStore.js` — RunPod, DeepInfra).
Keys stay encrypted at rest, never in argv, scrubbed by `routes/secretRedaction.js`.

## Legal

The MiniMax developer ToS — the document the research folder called "the single most important
unread document for this provider" — **was read on 2026-09-20** and is now folded into
`docs/proprietary-models-research/02b-chinese-providers.md`. WebFetch sees an empty shell; it
is JS-rendered and needs a real browser.

Headline: the resale bar carves out "**outside of any integrated applications**", end users are
explicitly contemplated, no attribution required on the hosted API, no territorial exclusion.
That is the permissive shape, and it **reverses research finding #4** for MiniMax specifically.
Kling and BytePlus are still unsafe.

Two things still open:
- Output ownership is not stated in the Platform terms. Probably in the Video product terms.
- The local draft is an Output of territory-restricted H3 weights (UK excluded, we hold a
  per-machine authorization). Feeding it to the hosted API is a use of that Output. Needs a
  lawyer line before this leaves dev-gate. See `docs/models/h3/README.md` § Licence.

Also worth stating to users plainly: this is a new outbound data path. Their footage goes to
MiniMax's servers.

## Related cards

- [MPI-707](../MPI-707/brief.md) — De-RoPE temporal super-resolution, the LOCAL answer to the same artefact.
- [MPI-477](../MPI-477/) — H3 refiner, the pixel-space route, after latent upscaling was disproven.
- [MPI-688](../MPI-688/) — Video Upscale: add H3 alongside LTX.
- [MPI-849](../MPI-849/) — DeepInfra BYO-key paid models. Ships first; sets the BYO-key precedent this card reuses.
