# Research & Synthesis Worksheet — LTX 2.5

- **Model version:** LTX 2.5 (distilled, int8, Gemma 4 12B text encoder)   **Mode(s):** t2v, i2v, r2v
- **Research date:** 2026-10-23   **Sources:** see `sources.md` (`#n` below = its row)

Lightricks ships 2.5's own enhancer system prompts (#1 t2v, #2 i2v). Per playbook 08 those ARE the
specification; web and community sources only fill gaps or carry measurements. Tags: **[V]** vendor code,
**[D]** vendor docs, **[P]** provider docs, **[M]** measured by someone on real renders, **[O]** opinion.

---

## Part A — Research (the 7 standard questions)

### 1. Output format & length

- One continuous, unlabelled paragraph of prose. No bullets, headings, or `Audio:` / `Visual:` labels;
  output only the caption, no preamble or JSON [V #1, #2].
- **Length: roughly 150–220 words** [V #1, #2]. The docs say 4–8 sentences for a single shot and let length
  follow the scene's complexity, not the clip's duration [D #4, #5]; 4–8 sentences of this density is about
  the same band.
- **No encoder wall:** `TOKENIZER_MAX_LENGTH = 1024`, truncate ≈ 768 words [V #3]. Any cap above 220 is a
  runaway guard, not a model limit. Runware caps input at 5,000 characters [P #6].
- **Number for `wordBudget`:** target 150–220; contract **{ min: 120, max: 280 }** (t2v/i2v). r2v adds
  15–50 words per picture line on top, as on 2.3.

### 2. Structural order

- Vendor caption [V #1]: open directly on the action or a visual detail (never "The scene opens…", "We
  see…", "There is…") → full visual detail (setting, materials, light, people, positions) → the framing
  triple woven in → chronological action ("Initially… / A moment later… / Simultaneously…") → complete
  soundscape integrated, not appended → closing aesthetic-quality descriptors in the same prose.
- i2v adds a FIRST step: the opening matches the start frame exactly, then the action unfolds from it [V #2].
- Docs order (shot, scene, action, character, camera, audio) [D #5] is compatible; the vendor's own
  "begin with the action" wins on the opener, and deAPI reports a subject-noun opener gives a near-static
  clip [O #7].

### 3. Vocabulary

- **Shot type, exactly one per shot** from a closed set: extreme wide / wide / medium / medium close-up /
  close-up / extreme close-up [V #1].
- **Viewpoint** from a closed set: front-facing / back-facing / side view / over-the-shoulder / top-down /
  low-angle / high-angle [V #1].
- **Camera motion always stated**; none → say the camera remains static [V #1]. Push-in, dolly, track,
  orbit, handheld, locked-off all recognised [D #5]. Give a move an end state ("pushes in until her face
  fills the frame") [D #5, O #7] — in i2v "very slow push-in" overshot 5/5 [M #8].
- **Transitions between shots** (multi-shot only): hard cut, match cut, dissolve [D #5].
- **Light** as a physical source with a direction [O #7]; **sound** tied to something visible; "no music"
  when none is wanted [P #10, D #5].
- **Aesthetic descriptors** the vendor wants woven in: cinematic, film-grade colour and contrast, natural
  lighting, crisp fine detail, depth [V #1]. "8K", "masterpiece" do nothing [O #7].

### 4. Mistakes & failure modes

- Inferred emotion ("she looks sad") → describe the face instead (brows, lips) [V #1]; emotion labels give a
  neutral face [O #7].
- Tag lists and labelled fields → "nothing happens" / cuts ignored [O #7].
- **Naming something that is not in frame pulls it into frame** [M #8: 6/10 and 4/7; 0/188 after the fix].
  Write the gaze direction, not the off-screen listener; the light on the face, not the lamp out of shot.
  Also argues against naming unwanted things at all (no negative-by-mention).
- Inferring ethnicity, nationality, religion or culture [V #1] — banned outright.
- On-screen text only partly reliable; chaotic physics artefacts [D #4].
- "Static" held only ~half the time in i2v [M #8]; state it plainly and firmly, never hedge it.

### 5. Negative prompts

- The distilled graph runs without CFG, so a negative field would be ignored [V #3, O #7]; the 2.5 guide
  uses none [D #4]. `negativeHandling: 'inline-positive'`, and exclusions written as the positive end state,
  never by naming the unwanted thing (#8's pull-in effect).

### 6. What's unique (and how 2.5 differs from 2.3)

| Rule | LTX 2.3 rewriter (`gemma3_*`) | LTX 2.5 rewriter (`gemma4_*`) [V] |
|---|---|---|
| Job | expand into a prompt | rewrite as a TRAINING CAPTION, scored against the user's original request: keep every stated element |
| Length | no number | ~150–220 words |
| Register | restrained, plain colour, neutral light | closing AESTHETIC QUALITY pass: film-grade colour, beautiful natural light, crisp detail |
| Camera | never invent motion | framing triple mandatory; "camera movement is expected and good" |
| People | gender, clothing, hair | identify specifically (gender presentation, skin tone, age group, hair, build, clothing); differentiate several people; never ethnicity/nationality/religion/culture |
| Sound | soundscape; speech only if asked | complete soundscape always; dialogue quoted exactly in its original language |
| Prefix | `Style: …,` | none; banned openers instead |
| i2v | describe only the change | open by matching the image exactly, then the action; single take, no cuts |
| Language | — | non-English request → English caption |

New on 2.5 [D #4, #5]: native **multi-shot** (2–4 shots in one paragraph); a **duration predictor** that times
the clip to the action written (in Vision the user sets the duration, so the action must fit it rather than
the other way round); the first+last-frame path hit the drawn end frame 6/6 [M #8].

### 7. Example prompts (paraphrased; full texts kept outside the repo)

- Vendor t2v caption shape: a medium shot from a side view as the camera slowly tracks a cyclist along a wet
  cobbled street at dusk; her yellow raincoat, the tyres hissing on stone, a bell ring, a distant tram; then
  "A moment later…" she brakes at a crossing; closing on warm cinematic light and crisp wet-stone texture.
- Official multi-shot [D #5]: one paragraph, a wide establishing shot, "hard cut to" a close-up re-naming the
  subject and the new framing, audio stated as continuing across the cut.
- i2v [V #2]: first sentence restates the start frame (who, what they wear, where, the light, the framing),
  then the requested action, camera and sound in time order.

### Conflicts & unknowns

1. **i2v: re-describe the first frame, or motion only?** Vendor rewriter: match the image exactly first [V #2].
   Comfy docs / deAPI: "describe what happens next", re-describing drifts identity [P #9, O #7]. **Vendor
   wins** — it is the caption style the checkpoint was trained on, and Vision's i2v Enhance sees each staged
   picture through a written description (`seesPictures`, `pictureCaptions`), so the grounding has material
   to work from. Stage 2 decides if identity drifts; the motion-only form is the fallback.
2. **Camera invention** [V #1] vs Fabio's 2.3 spec (user's move, else static; plain words → optical term).
   **Fabio's spec wins**, as recorded in `ltx-2.3.recipe.js` ("When an `ltx-2.5` recipe is built from that
   file, this rejection applies there too").
3. **Music.** Vendor: complete soundscape incl. background music. Inventing a score the user never asked
   for changes the clip. Inferred rule: music only when the user asks or the scene plainly carries it (a
   party, a concert); otherwise say there is no music. Basis: inferred.
4. **r2v has no vendor file.** The Ingredients sheet path is app-built (2.5 ships its own
   `ltx25-lora-ingredients`). The 2.3 r2v mode is Fabio-validated (MPI-1084, 24/24); its picture-line block
   is about the sheet, not the model's caption style, so it carries over and only its scene rules change.
5. **Off-frame naming** [M #8] is one author on distilled i2v. Adopted: cheap, and it agrees with the
   observable-only rule.

---

## Part B — Synthesis (map to the recipe)

| Field | Value |
|---|---|
| `modelId` | `ltx-2.5`; ModelDef `ltx-25` gets `enhanceRecipe: 'ltx-2.5'` (today it reaches `ltx-2.3` through `type: 'ltx'`) |
| modes | `t2v` (from #1), `i2v` (from #2, `seesPictures: true`), `r2v` (2.3's validated sheet block + 2.5 scene rules) |
| `outputFormat` | prose paragraph (t2v, i2v); r2v keeps 2.3's `<Picture n>` lines + scene |
| `wordBudget` | t2v/i2v `{ min: 120, max: 280 }` (target 150–220); r2v `{ min: 100, max: 420 }` |
| `negativeHandling` | `inline-positive` |
| `multiScene` | `false` by default; the recipe writes 2–4 shots only when the user asks for cuts or shots (t2v only; i2v stays one take [V #2]) |
| register | the vendor's aesthetic-quality close — the OPPOSITE of 2.3's restrained-language rule, so none of 2.3's `forbiddenPatterns` against "film-grade" may carry over |
| camera | framing triple required every shot; MOTION = the user's, translated to the optical term, else static (Fabio's spec); every move gets an end state |
| people | specific identification + attributes; ethnicity/nationality/religion/culture never inferred |
| sound | full soundscape, dialogue quoted in its own language, music only when asked or plainly implied |
| bans | the three openers; labels; emotion words in place of faces; naming anything outside the frame; timestamps |

### Readiness verdict

Ready to draft. Vendor spec read in full for both modes that have one; the r2v carry-over and the music rule
are the two places resting on inference rather than vendor text — read their outputs, not just the score.
