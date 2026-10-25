# H3 Reference Fast Motion — one switch, four routes

> Part of [MiniMax H3](README.md). MPI-1285, built 2026-10-25 on the MPI-1135 bench verdicts.
> **MiniMax H3 Reference (`minimax-h3-ref2va`) only.** MiniMax H3 (fl2va) never gets it
> (Fabio, MPI-1135 Phase 1e).

## Why it exists

The two-pass graph draws stage 1 at HALF the target size and lets the 3D latent upscaler
double it. On fast action (a launch, a chase, a fight) the half-size draft smears the motion
and the refine cannot recover it: in MPI-1135 Phase 1 the no-upscale path won every time.
Fast Motion draws the action at the native size instead.

## How it is wired

One `MpiSimpleBoolean` titled `Input_Fast_Motion` (default false) in
`comfy_workflows/raw/minimax_h3_r2va_template.json`. Everything else is derived IN THE GRAPH
from `Input_Width` / `Input_Height`, so a Flow, a routine or an old sidecar that never sends
the switch runs exactly today's path.

- `Base Width` / `Base Height`: the `medium` cell of the target's shape: 768x768, 1344x768,
  768x1344, 1536x640 (21:9 is any width over 2.2x the height).
- `Fast Motion Mode` (an int, `a`=width, `b`=base width, `c`=switch):

| mode | when | stage 1 | after it |
|---|---|---|---|
| 3 | switch off | half the target (`floor(a / 64) * 32`) | 2x upscale + refine (today) |
| 0 | on, target <= base (very_low, low, medium) | the target | nothing: stage 1 is decoded |
| 1 | on, target <= 2x base (high, very_high, 2K except 21:9) | the base | one upscale to the target + refine |
| 2 | on, wider (4K, and 21:9 at 2K) | the base | upscale to 2x base, then to the target, + refine |

Mode 2 is the brief's "4K = two hops" written as one rule for every ratio (16:9 4K:
1344x768 -> 2688x1536 -> 3840x2176). Both skips are lazy `MpiIfElse` nodes, so the
upscaler(s) and the refine never execute when not needed.

`Refine Width/Height` feed `Window Frames`, `Refine_Refs` and hop 2: the refine size is the
target in modes 0-2 and hop 1 in mode 3 (identical to before). So the time-chunked refine
(`MpiWindowedSampler`, [windowing.md](windowing.md)) plans its windows off the real refine
canvas in every mode. Every tier x ratio x mode was evaluated through MpiNodes' `safe_math`
on the runtime graph: each delivers its labelled size, and switch-off plans are unchanged.

## sol-attn

Core `BlockSparseAttention` (`sol-attn`, tau 1.3, from 20%, `exact_kv_and_rows`) sits on the
STAGE-1 model, after the turbo/non-turbo switch, in every switch state. That is where MPI-1135
Phase 2 measured it (it looked better and was 15% faster on turbo, 30% with EasyCache
non-turbo). The refine model is untouched: it was never measured there.

## App side

- Button `h3FastMotion` beside Turbo (capability `h3FastMotionToggle`, perModel, default off).
- Preview greys out in mode 0 (nothing to stop after), and a saved Preview ON is ignored.
- `h3FastMotionOnePass()` in `js/utils/ratios.js` is the JS copy of mode 0, used for that and
  for the bar count (mode 0 is ONE progress bar, not two). `tests/h3-fast-motion.test.cjs`
  pins it to the graph's expressions.
- Agents: named param `fastMotion` (connector, MCP, Cosmo). Cosmo's rule is in
  `docs/agent/models/minimax-h3.md` § Settings: on for fast action, without asking.

## Not measured

- Mode 1/2 quality on fast motion: Phase 1's losing upscale drew the motion at 672x384; these
  draw it at 1344x768. Fabio's in-app test is the first look.
- 4K is out of reach on 16 GB on either path ([windowing.md](windowing.md)).
