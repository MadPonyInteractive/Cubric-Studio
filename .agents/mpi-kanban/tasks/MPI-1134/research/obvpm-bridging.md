# Research: long H3 shots with no drift — one long draft, and bridging (OBVPM)

2026-10-25. Source: ChanonDevs, "40 secs, No Degradation! - How to make Long Continuous Single Shot
Videos with MiniMax H3" (YouTube GiJxlWOooyo, 2026-10-07, 36 min), watched from its captions.
Workflow: `chanon/comfyui-obvpm-timeline`, **GPL-3.0 → ideas only, nothing copied** (same rule as
LTX Director in MPI-1191). Fabio, 2026-10-25: "a research technique that should be considered and
used" for Story / Infinite Video.

## READ FIRST — what changed after this was written (Fabio, 2026-10-25, MPI-1135)

**Fabio, 2026-10-25 (supersedes anything below that differs):**
- **No new workflow for Story.** Infinite Video and Cosmo's generations run the Singularity H3
  model workflow (MPI-1284) as is; LoRAs added to it are not Story's concern. H3 also joins the
  Extend Video Flow, so extend/bridge use whatever that model workflow provides.
- **Always generate at 1344, never lower.** Above that, the tier upscales. 1344 already has
  unnoticeable tearing, so the cheap low-res draft is off the table.
- **Fast Motion is chosen per scene by the planner:** OFF for a talking close-up and for medium
  shots at slow/medium pace; ON for fighting, running, jumping, car chases — a lot happening fast.
  This is a field the shot planner sets, not the user per shot.

Confirmed by the H3 Singularity 7 session from MPI-1135 / MPI-1284 / MPI-1285 records.

- **Singularity H3 v2 is the only H3** (one ref2va file: t2v, i2v, ref2v). 2.1.3 deprecates
  MiniMax H3 + H3 Reference (build card MPI-1284). Turbo 8-step LoRA stays; non-turbo 25 steps;
  sol-attn always on (+ EasyCache non-turbo). Ref prompts always use sections.
- **Fast Motion (MPI-1285):** OFF = today's two passes (stage 1 at HALF canvas, 3D latent
  upscaler ×2, windowed refine). ON, Very Low–Medium = ONE pass at target size, no stage 2.
  ON, High and up = stage 1 at NATIVE 1344×768 (Medium cell of the ratio), then upscale ~1.24×
  (High) to ~1.9× (2K); 4K = two hops. Whether that still tears on fast motion: not benched.
- **Technique 1 below is NOT supported by our bench.** Our 0.26 MP draft + 2× lost to no-upscale
  on fast motion every time, and only tied on calm motion. 0.2 MP + 3× was never run on
  Singularity. Story drafts follow the app's tiers above, not his 0.2 MP recipe.
- **Windows** are sized from the stage-2 target (90 frames at 1.6–6 MP, 39 at 4K, overlap 17),
  never a fixed 5 s, never spatial tiles (`docs/models/h3/windowing.md`).
- **Root alignment:** a canvas change is a different latent shape, so the same seed gives a
  different sample (`js/utils/ratios.js`). Roots must share seed, duration AND canvas.
  Framing stability itself is untested on Singularity.
- **Bridging (context from both ends):** untested, no evidence either way. It is the first bench
  the Story work needs; the bridging lessons below are his, from the old H3.

## The problem it solves

Chain-extending (each clip continues from the previous clip's latents) **drifts**: after six
extensions of a static talking shot the background reds shift and the face goes darker and more
contrasty. Static shots are the worst case — the model re-draws the same background from drifted
latents and the error accumulates. Moving shots (pan to new background) drift less. Pixel-path
extend (VAE decode → encode) is worse still. Matches our `extend` join mode's weak spot.

## Technique 1 — one long clip at very low res, then windowed upscale

- 40 s in ONE generation at **0.2 MP** (352 wide → ×3.09 → 1088, ~2 MP), 8 steps, no turbo
  (turbo gives a plastic look), res_multistep/simple. ~20 min draft, ~1 h upscale on a 5090.
- **0.1 MP is mush** (colours blink, upscales badly). 0.2 MP works. 60 s seemed to work, untested.
- Upscale = latent upscale + resample in **5 s windows, ~1.3 s overlap, step-major** (step 1 over
  every window, then step 2...). VRAM need = one window. VAE decode is windowed too (progress bar).
  This is our `MpiWindowedSampler` (MPI-699) / continuity.md "low-res chain, upscale at the end".
- The upscale reuses the **conditioning saved at draft time** (`.cond.safetensors` beside the MP4),
  so references need not be re-wired and high-res references feed detail back in. Our
  shot-pipeline "save the latent" should save the conditioning too.
- Hallucinations at a big upscale factor come from detail with no reference to draw from: give
  references, or drop "refine amount" (denoise) to ~0.2.
- Dialogue + duration must match: too long → gibberish after the line ends, too short → lines cut.
  2-3 tries to land one. Our planner must size a shot from its words.

## Technique 2 — bridging (the one Fabio wants)

Plan the whole sequence first, then:

1. Write the script; an LLM (Claude with an H3 prompt skill) splits it into ~6 s prompts.
2. Generate the **odd** clips (1, 3, 5...) as **root** generations — fresh, full quality.
3. Generate the **even** clips as **bridges**: motion-context latents from the END of the clip
   before AND the START of the clip after. Real motion carries through both seams (a hand rising
   across the join), not first/last-frame interpolation.
4. Result: 15 clips, no colour drift first to last. Any section can be redone by bridging again.

Lessons that cost him time — each is a rule for our planner:

- **Roots must align.** Same reference start image is not enough: roots also need the **same seed
  AND the same duration** (same initial noise → same framing/background). Small residual drift is
  absorbed by the bridge. (Ties to shot-pipeline "Draft resolution": H3 framing is not pinned.)
- **Bridge prompts must be SHORT.** A detailed per-beat prompt makes the model obey it and hard-cut
  at the START. What worked: "single continuous shot, no cuts; the subject speaks in one continuous
  shot: «line»" and nothing else.
- **Bridges need far more time than the beat.** A 6-8 s beat needed a **12 s** bridge (keeps ~9.5 s;
  the rest overlaps the neighbours). Too short → the model finishes the prompt, runs out of room and
  hard-cuts at the END. His read: it follows the prompt first, then spends what is left joining.
- Bridge seeds can vary freely (only roots need the fixed seed); try a few seeds per bridge.
- **Pacing fix:** a root that speaks too fast can't be re-rolled longer (duration change = shifted
  background). Instead: bridge into it, delete it, extend a new one, bridge on.
- Cost: draft timeline "a few hours" at 0.2 MP; upscale of the whole bridged timeline 104 min
  (95 sampling + 10 decode) on a 5090.
- Combining both: bridge 30-40 s roots instead of 6-10 s ones → fewer seams.

Also in his paid build: **two-stage draft** (low-res first steps, latent upscale, finish) and
**Seed Hunt** (up to 16 stage-1 drafts side by side, pick which go to stage 2) — the same shape as
our draft → review → upscale pipeline. His Result Preview **scores each seam**; worth having.

## What it means for Story (MPI-1134)

- **New join mode `bridge`** beside extend / lastFrame / newShot / cut (`docs/story/continuity.md`):
  the shot is generated LAST, from both neighbours' latents. For any continuous run longer than one
  generation, the planner lays roots + bridges instead of a chain of extends.
- **Planner output changes:** run order ≠ story order (roots first); roots share seed + duration +
  start ref; bridge prompt template is fixed and short; bridge length = beat + ~3-4 s overlap.
- **Engine gap to check first (bench):** our Extend Video H3 arm (MPI-591) is extend-only, and
  today's H3 arm is the pixel path (gap G3). Bridging and prepend need motion context on BOTH ends.
  OBVPM proves H3 can do it; whether `MiniMaxH3MotionContext` (or our port) takes a tail context, or
  it needs our own node, is unverified — read the node signature before designing.
- **Draft canvas (MPI-1135):** one more data point — 0.2 MP drafts upscale cleanly ×3 *with a start
  frame and references*; 0.1 MP does not.
