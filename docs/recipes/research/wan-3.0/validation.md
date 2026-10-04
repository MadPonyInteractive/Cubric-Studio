# Validation Record — Wan 3.0

## Stage 1 — autonomous text-only loop (agent)

- **Recipe / modes:** `wan-3.0` / `t2v`, `i2v`, `r2v` (and `r2v --ref-tiers`)
- **Enhancer model:** `huihui_ai/gemma-4-abliterated:12b` (registry id `gemma-4-abliterated-12b`)
- **Judge model:** `gemma3:12b`
- **Runs per tier:** 3 (a tier passes only if all 3 pass); every mode swept twice
- **Harness:** `node scripts/recipe-test.mjs wan-3.0 --engine gemma-4-abliterated-12b --judge gemma-3-12b --runs 3 [--mode i2v|r2v] [--ref-tiers]`, under `gpu_lease.py run`
- **Date:** 2026-10-04 (MPI-1018)

### Result — green twice on every mode but one case

| Mode | Sweep A | Sweep B |
|---|---|---|
| `t2v` (5 tiers) | ALL PASS | ALL PASS |
| `i2v` (5 tiers) | ALL PASS | ALL PASS |
| `r2v --ref-tiers` (references attached, 4 tiers) | ALL PASS | ALL PASS |
| `r2v`, no references attached (5 tiers) | `directed` 0/3, rest 3/3 | `directed` 1/3, rest 3/3 |

`t2v` is from the original draft (`9ad40e6cb`), untouched since; the other three rows are on
the final text.

**Open: `r2v` with no references, `directed` tier.** The garbled technical input ("a cowboy ...
shooting on a Thufpik eye skin detail, pores, anamorphic lens") gets an invented `<Image 1>`
and the recipe's own role sentence, in 5 of 6 runs, despite "Attached references ...: none":

> A close-up shot of a cowboy in `<Image 1>` aims his weapon. `<Image 1>` is the character. ...

Every other no-reference tier writes plain prose with no tag. In the app this is Enhance on
`ref2v` before any reference is staged; once one is staged the invented tag names a real file.
Seedance's recipe passes the same tier; what differs is still unknown. Three rewordings did not
move it (rounds 4-6 below).

### Word counts on the final text

| Mode | bare | medium | directed | overlong | general |
|---|---|---|---|---|---|
| `t2v` (min 30, max 240) | 82-107 | 85-137 | 72-112 | 188-224 | 88-118 |
| `i2v` (min 15, max 180) | 22-62 | 33-70 | 35-64 | 123-140 | 31-50 |
| `r2v` refs (min 20, max 240) | 38-53 | 61-79 | 61-84 | 159-**239** | — |
| `r2v` none (min 20, max 240) | 23-45 | 44-63 | 48-69 | 180-219 | 33-47 |

**`r2v` refs `overlong` hit 239 against a 240 cap**: one word of headroom on one run. It passed,
but the condense rule is not holding that tier well clear of the ceiling.

### Representative outputs

`t2v` medium:

> A man sits in a wooden rocking chair by a roaring stone fireplace, with two fluffy cats nestled at his feet on a plush rug. ... Shot 1 [0-5s]: The man leans back and smiles as the chair rocks slowly and steadily, a slow push in toward his peaceful expression. Shot 2 [5-10s]: The camera pans right to reveal the two cats ... No dialogue. The crackle of wood in the fireplace and a slow, melodic acoustic guitar. Cozy warm atmosphere.

`i2v` bare (18-word floor case):

> The cat in the frame stretches its paws forward and tilts its head. A slow push in. The cat lets out a soft meow. Purring and a soft rustle of grass.

`r2v` refs medium:

> The man in `<Image 1>` sits on a rocking chair in `<Image 2>` with two cats at his feet by the fireplace. `<Image 1>` is the character. `<Image 2>` is the setting. The man rocks gently back and forth while the two cats nuzzle each other. ... Shot 1 [0-4s]: A slow push in focuses on the man and the cats. Crakling fire sounds. Warm amber tones.

### Iterations

| Round | Failing | Cause | Change |
|---|---|---|---|
| 1 | `r2v` refs: tags "missing" in 11/12 runs | Harness sent Seedance's `@image1`; the app sends `<Image 1>` for Wan 3.0, and the model rewrote `@image1` into that form | Harness writes tags with `refTagHandle` on the recipe's own model and recognises both forms |
| 1 | `r2v` bare/general 25-36 words vs min 40 | "Keep it short; the references carry the visual detail" | `r2v` min 40 → 20 (i2v's floor, same reason) |
| 1 | `Style:` (5), `Action:` (1) labels | r2v's style line had no inline example; "Then the action:" read as a label | t2v's proven style sentence; "Then describe what unfolds" |
| 1 | `i2v` directed: "Wait, ..." self-argument | Unclear whether to write "No dialogue." when nobody speaks | i2v + r2v: nobody speaks and no silence asked → leave speech out |
| 2 | `r2v` none: invented `<Image 1>` (newly visible: the old regex saw only `@`) | Opening sentence told it to cite references unconditionally | Cite only when attached; none → no tag anywhere |
| 2 | `r2v` refs bare 12-17 words, no movement | "Keep it short" suppressed the action part | Action is in every prompt: at least one concrete movement |
| 2 | `i2v` "Wait, ... Thufpik might be a typo" | i2v/r2v endings lacked "no explanation" | Added it + "If you would reconsider, do it silently ..." (sdxl/pony wording) |
| 3 | `r2v` none: `<Image 1> is the character.` | Role-sentence paragraph unconditional | Role sentences only when attached; unknown word = typo, never a reference |
| 3 | `i2v` "I noticed the user didn't provide a last frame" | App never tells the enhancer about a last frame | Last-frame branch keyed to the user's own words |
| 4 | `i2v` bare 18-19 vs min 20 | Floor too high; the 18-word outputs are complete | `i2v` min 20 → 15 |
| 4 | `i2v` overlong 212: prompt + "**Note:**" + prompt again | Round 3's "never mention a last frame" handed it a topic | Plain conditional; "Your reply ends where the prompt ends: no note, no second version" |
| 4 | `r2v` none: still invented | Opening said "The user has attached reference files" | "may have attached" |
| 5 | `r2v` none directed only | — | Seedance's positive none-rule: start with the subject in words, no tag, no "is the character" sentence |
| 6 | `r2v` none directed: 5/6 still | Unresolved | Stopped here |

### Known limitations the judge waves through

- `t2v` writes `Shot 1 / Shot 2` segments when no cuts were asked for (the medium output above).
- `t2v` and `i2v` still write "No dialogue." when nobody speaks and silence was not asked for.
- A style line ("Warm amber tones") appears when the user named none.

All three are rule breaks a Wan 3.0 render can judge better than a 12B grader. Stage 2 is next.

## Stage 2 — real renders (Fabio)

Not run. Costs money (DeepInfra, $0.05-0.20/s). The recipe stays `draft` until it is.
