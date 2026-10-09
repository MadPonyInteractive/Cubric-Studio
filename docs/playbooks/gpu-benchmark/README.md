# Benchmark a RunPod GPU for the picker's Gen speed bar

> How to measure a RunPod card that has no **Gen speed** bar in the GPU picker, so its number
> sits in the same table as RunPod's own. Runner: `scripts/bench-gpu-klein.mjs`. Table it
> feeds: `GPU_GEN_SECS` in `js/data/runpodGpuSpecs.js`. Where the bar is drawn and why it is
> Klein: [../../runpod-remote-engine.md](../../runpod-remote-engine.md) (search `Gen speed`).
> First run: MPI-1054 (five cards, 2026-10-09). Runner + this page: MPI-1055.

## When you need this

A card in the picker shows no bar: nobody has benchmarked it. **Check RunPod first, it is
free.** Their published table is runpod.io/articles/guides/best-gpu-for-comfyui (FLUX.2
Klein 9B section). A card they publish goes into `GPU_GEN_SECS` as their number, with no
`// ours` marker, and costs nothing. Only a card they skip needs this page.

There is also a keyless API behind their `/gpu-compare/X-vs-Y` pages
(`benchmarks.getrunpod.io`), but it is Hugging Face **Diffusers** on SDXL and FLUX.1-dev,
not ComfyUI on Klein. Do not convert it: the Klein/SDXL ratio swings 0.50-0.95 across cards.

## What gets measured, and why it matches RunPod

| Setting | Value |
|---|---|
| Model | FLUX.2 Klein 9B **bf16** (`black-forest-labs/FLUX.2-klein-9B`, gated), `qwen_3_8b_fp8mixed` text encoder, `flux2-vae`. NOT the int8 Klein the app ships |
| Graph | Comfy's official Klein 9B t2i: 4 steps, euler, cfg 1, 1024x1024 |
| Engine | ComfyUI `v0.39.0` (the engine we ship) on `runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2204` |
| Timing | On the Pod, from ComfyUI's own `/history` (`execution_start` -> `execution_success`), no network |
| Number shipped | Median of 10 images, **a new prompt every image** |

**RunPod's numbers include encoding the prompt on every image.** That was established by
calibration: with a new prompt each image, our A40 measured 4.6 s against their 4.80 and our
A5000 6.75 s against their 6.46. With one repeated prompt (text encoder output cached) both
ran 20-30% faster and would have overstated every card. The runner still records the cached
figure (`secsCachedPrompt`) as a diagnostic. Never ship it.

## Run it

Keys come from the environment, never from the repo:

- `RUNPOD_API_KEY`, or `RUNPOD_ENV_FILE` = a file holding a `RUNPOD_API_KEY=` line.
- `HF_TOKEN`, or `HF_TOKEN_FILE`, for a Hugging Face account that has **accepted the Klein 9B
  licence**. A 403 when signing means that account has not accepted it, or the token is
  fine-grained without "read access to public gated repos". The token never reaches a Pod:
  the runner signs the download on this machine and passes the Pod only a 60-minute CDN link.

On Fabio's machine both key files are named in project memory
(`reference_runpod_gpu_benchmarks`). Ask him before using any other key.

```bash
node scripts/bench-gpu-klein.mjs --plan --calib "NVIDIA A40" "NVIDIA L40,NVIDIA A100 80GB PCIe"
```

`--plan` prints price and stock per card and spends nothing. Card names are RunPod's GPU type
ids exactly; a typo prints `NOT IN CATALOGUE`. Then the real run, with a cap:

```bash
node scripts/bench-gpu-klein.mjs --cap 1 --calib "NVIDIA A40" "NVIDIA L40,NVIDIA A100 80GB PCIe"
```

- **This costs money: ask Fabio first**, with the cards, their $/hr and the cap.
  A card costs about 7-9 billed minutes (create to ComfyUI up 2.6-5.4 min, then 1 warm-up
  and 15 images). Five new cards plus two check cards cost about $0.35 on 2026-10-09,
  not counting the two mistakes in the traps table below.
- `--calib <id>` runs one card RunPod already measured, alone, first. If its result is more
  than 10% off `GPU_GEN_SECS`, the runner stops before renting the rest. A40 ($0.59/hr) and
  RTX A5000 ($0.27/hr) are good check cards: both landed within 5%. Skip `--calib` only for
  a re-run the same day with the same setup.
- `--cap <USD>` is enforced every 10 s from each Pod's rate x wall time; going over deletes
  every Pod.
- A sold-out card is retried every minute for 45 min. Nothing bills while it waits. All cards
  run in parallel after the check.
- Results append to `logs/gpu-bench.jsonl` (gitignored). The line to ship is `secs`.

Run it in the background and watch for `RESULT`, `ERROR` and `DONE` lines; a run takes
5-50 min depending on stock.

## Land the result

1. Add the row to `GPU_GEN_SECS` in its sorted place, as `'<RunPod id>': <secs>,  // ours`.
   Leave RunPod's own rows exactly as published.
2. If the card was the "unbenchmarked" example in `tests/gpu-picker.test.cjs` (it was the
   L4, now the H200), move the example to another card nobody has measured.
3. `node --test tests/gpu-picker.test.cjs`, then put the card list in the `ours` sentence of
   `docs/runpod-remote-engine.md`.
4. Record cards, `secs`, `secsCachedPrompt`, the check card's result and the spend in the
   card's `validation.md`.

## Traps that already cost money

| Trap | What happened | Now |
|---|---|---|
| A bare `wait` in the Pod script | It also waited on the 40-min self-remove `sleep`, so ComfyUI never started: 25 billed min ($0.25) for nothing | Every `wait` names its PIDs |
| Host driver older than the image's torch | A 6000 Ada landed on a host reporting CUDA 12.8; torch refused it, the container restarted and looped, billing $0.99/hr for 20 min | `gpu.minCudaVersion` 12.9, and a second boot of the container deletes the Pod |
| Single-stream download | Suspected slow from a US CDN to an EU host | `aria2c -x16`: 27 GB in 32 s. A network volume is NOT worth it: it saves those 32 s and pins every Pod to one datacenter where most cards are sold out |
| Process killed mid-run | `TaskStop` on Windows can skip the cleanup handlers | Each Pod removes itself after 40 min. Still check `GET /v2/pods` is empty afterwards |
| Wrong key file | In the Pod-runtime repo's `.secrets/`, `pod_token.txt` is the wrapper token (401 from RunPod). `runpod.env` is the account key | Named in memory |

The Pods are named `cubric-gpu-bench`, so the app's own orphan sweep (it reaps only
`cubric-vision`) never kills a benchmark, and a benchmark never touches the user's Pod.
