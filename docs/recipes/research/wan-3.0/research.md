# Research & Synthesis Worksheet — Wan 3.0

- **Model version:** Wan 3.0 (`Wan-AI/Wan3.0-Video`)   **Mode(s):** t2v, i2v, r2v
- **Research date:** 2026-10-04   **Sources:** see `sources.md`

---

## The 7 standard questions

### 1. Output format and length

**Format:** Natural-language prose, optionally structured as a shot list. No keyword prefix block.
Wan 3.0 accepts a single sentence and a full mini-screenplay equally well. [src 1]

**Hard ceiling:** 20,000 characters per the API reference. Each Chinese character or Latin letter
counts as one character; the server auto-truncates on overflow. [src 2]

**Structured shot format:** `Shot N [Xs-Ys]: description` or `Segment N (00:00-00:03): description`.
Recommended segment length: 2-5 seconds. Segments join end to end without gaps. [src 1]

**Word budget rationale — derived (no source states a word budget explicitly):**

The official examples range from 9 words (a single bare shot) to ~57 words (a three-shot story with
no audio). The API cap at 20,000 chars is effectively no constraint on practical prompt lengths.
`prompt_extend` is on by default and rewrites the input before generation, so the raw enhancer
output can be shorter than what the model ultimately receives.

Budget sizes adopted in the recipe:
- **t2v: 30–240 words.** A single-shot expansion of "cat" should be at least 30 words; a
  multi-shot narrative with dialogue and audio hits 150-200 words without padding.
- **i2v: 20–180 words.** The first frame carries appearance and setting; the enhancer
  describes only motion, camera, dialogue, and audio.
- **r2v: 40–240 words.** Anchor phrases per reference tag add ~30 words; the narrative
  and action are similar to t2v.

These are starting values to be calibrated in Stage 1 against the enhancer of record.

### 2. Structural order

Official structure from src 1, adopted verbatim:

1. **Overall description** — subject, setting, opening action (one paragraph)
2. **Reference citations** (r2v only) — one brief phrase per reference giving it a job
3. **Action** — continuous take OR `Shot N [Xs-Ys]:` segments (2-5 s each) when cuts are requested
4. **Dialogue** — `Character says: "line."` or `Voiceover: "line."`
5. **Sound effects and music** — described as plain sentences
6. **Style and mood** — brief aesthetic descriptors
7. **Negative list** — only when the user excluded something; no padding

The OpenArt guide (see scratchpad/wan3-research.md) recommends Subject→Camera→Style→Sound,
which differs from the official Alibaba order. The official guide outranks OpenArt (src 1 vs.
platform guide), so the official order is adopted. [decision from MPI-1018 dispatcher]

**Timestamps ARE allowed** — the official guide explicitly shows and recommends `Shot 1 [0-3s]`
syntax. This is different from Seedance 2.0 where the vendor called precise timing "unstable."
The Seedance timestamp ban does not carry over. [src 1]

### 3. Vocabulary

**Camera moves** — from src 1: push in, pull out, orbit, dolly, crane, handheld follow, whip pan,
fixed shot. The official guide specifies "one move per shot." Speed is stated in plain English
("slow push in", "fast orbit").

**Focal lengths in millimetres** — the official guide uses "85mm telephoto" as a vocabulary example.
Millimetres are valid for Wan 3.0. The Seedance degrees-not-millimetres conversion does NOT apply
here. [src 1, confirmed by MPI-1018 dispatcher]

**Audio vocabulary** (unique to Wan 3.0) — from src 1:
- Dialogue: `Character name says: "line."` or `Voiceover: "line."` — name the speaker, quote
  the line, optionally add a delivery note and accent.
- Voice cloning: `Voice timbre reference [Audio N tag].`
- Sound effects: described as plain sentences ("footsteps crunch on gravel").
- Music: instrument, tempo, scope ("slow cello builds under the scene").
- Suppress audio: `No dialogue.` / `No background music.` — only when the user wants silence.

**Shot sizes** — no closed set documented for Wan 3.0. Carrying forward from Wan 2.2 as reasonable
defaults (derived from src 3 which covers the 2.2 enhancer, status DERIVED):
medium shot, medium close-up, wide shot, close-up, extreme close-up, low-angle shot, high-angle
shot, over-the-shoulder shot, aerial shot.

### 4. Failure modes

From src 1:
1. **Describing static imagery** — Wan 3.0 needs temporal progression (who does what over time),
   not a scene snapshot.
2. **Unlabelled reference assets** — assets without a citation tag are ignored or misapplied.
3. **Conflicting camera moves** — two camera movements in one shot produce erratic results.
4. **Unintended audio generation** — Wan 3.0 generates audio by default. A prompt with no audio
   specification gets auto-generated voice, effects, and music. Must be disabled explicitly if
   unwanted.
5. **`prompt_extend` corrupting structured syntax** — the Prompt Extend rewrite can corrupt
   citation tags and timestamps. For reference and multi-shot prompts, the app may need to
   disable it. [src 1, src 2]

Additional (derived from Wan 2.2 experience, status DERIVED):
6. Ambiguous cast count — extra people hallucinated when the count is not stated.
7. Vague motion verbs — "walks" without pace or sequence.

### 5. Negatives

**No separate API negative-prompt field.** Confirmed in the API reference. [src 2]

All negative constraints go into the main prompt as trailing exclusions ("no lens flares") or as
positive locks ("camera does not move"). The negative list is a trailing section at the end of the
prompt, and the official guide says: write only what was excluded; do not pad. [src 1]

`negativeHandling: 'inline-positive'` (same as Wan 2.2, but now structural rather than a workaround
for a disabled field).

### 6. What is unique

1. **Native omni-modal audio** — Wan 3.0 simultaneously generates synchronized dialogue,
   sound effects, and background music from a single prompt. Audio is ON by default.
2. **Long clips (2-30 s)** — wider than earlier Wan variants; smart-duration mode (`-1`) available.
3. **Multi-reference capacity** — up to 9 images, 3 videos, 3 audio references in one call (as
   served by DeepInfra; the API reference states higher limits). A character-image + location-image
   + voice-audio call is a first-class pattern.
4. **Cloud-only** — no open-source weights, no Wan 3.0 GitHub repo. API-only via Alibaba DashScope
   and DeepInfra. No ComfyUI local deployment is possible.
5. **Shot segment support** — timestamps (`Shot 1 [0-3s]`) are explicitly stable and recommended
   by the vendor. This is the opposite of Seedance 2.0's guidance.
6. **Video editing** — the model can edit an existing video clip (remove/replace/delete elements);
   this op is not currently surfaced in Vision and is not covered in this recipe.

### 7. Examples

Written fresh for the recipe; no substantial third-party text copied in.

---

## Wan 2.2 → Wan 3.0 delta (for the dispatcher)

Key changes (full table in `scratchpad/wan3-research.md`):

| Dimension | Wan 2.2 recipe | Wan 3.0 recipe |
|---|---|---|
| Prompt structure | 6-part prose, structured-tags outputFormat | prose, official 7-element order |
| Length / wordBudget | 50-150 words, 80-120 target | 30-240 words; multi-shot expands range |
| Multi-shot | None | `Shot N [Xs-Ys]:` segments, 2-5 s each |
| Audio | Not generated | On by default; must suppress explicitly |
| Reference tags | None (t2v/i2v only) | `<Image N>` / `<Video N>` / `<Audio N>` (app form) |
| Focal lengths in mm | Allowed (Wan 2.2 vocabulary has them) | Allowed (src 1 confirms) |
| Timestamps | Not applicable | Allowed and recommended by vendor |
| Negative handling | inline-positive (CFG=1 workaround) | inline-positive (no API field) |
| MoE architecture | Dual-expert, prompt order significant | Unknown; no architecture docs for 3.0 |

---

## Unresolved unknowns

1. **Architecture** — Is Wan 3.0 still MoE? No source confirms or denies. The prompt order
   in this recipe follows the official guide, not the MoE routing argument from Wan 2.2.
2. **Vocabulary confirmation** — Shot sizes and the closed lighting set from Wan 2.2's
   `system_prompt.py` may not transfer. No Wan 3.0 system prompt is publicly available.
3. **`prompt_extend` behaviour with tags** — whether disabling it for ref2v improves quality
   is a Stage 2 question (a render is required to observe audio/tag fidelity).
4. **Reference count limits** — API reference says 10 images / 5 videos / 5 audio; DeepInfra
   as served limits to 9 images / 3 videos / 3 audio. The recipe uses the served limits.
