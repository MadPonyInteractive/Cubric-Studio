/**
 * Qwen-Image 2.1 (Alibaba, 2026-09-20) — Vision's `qwen-image-2-1` (MPI-936, MPI-1048).
 *
 * Built from the vendor's own prompt rewriter. Qwen ships two separate 9B rewriter models
 * (PE-T2I, PE-I2I) whose system prompts are published in `QwenLM/Qwen-Image-2.1`
 * `prompt_rewrite/prompts/`; Vision does not ship those models, and the encoder itself
 * adds nothing but a one-line system turn ("Comprehend and analyze the provided prompt."),
 * so THIS RECIPE IS THE ONLY REWRITER A VISION USER GETS. The rewriter turns any brief,
 * three words or three hundred, into one long observational English paragraph: an opening
 * sentence naming the medium, a walk round the frame, every legible string quoted, a
 * lighting sentence, one closing sentence. That is what 2.1 was trained to read.
 *
 * THE OPPOSITE OF THE RECIPE IT REPLACES. 2.1 borrowed `flux` -> `flux-2` (Klein:
 * condense-first, 35-120 words, subject in the opening words). The vendor's rule is
 * expand-always, ~450 words. Do not "harmonise" the two.
 *
 * Length: the vendor says 400-500 words. The harness's `overlong` tier is a 410-word
 * brief whose `condensed` check needs a SHORTER output, so the vendor figure fails the
 * condense job by construction; the draft keeps the vendor's whole structure at 250-350
 * stated / 200-400 checked (`docs/recipes/research/qwen-image-2.1/research.md` § 1).
 * Whether the full 450-word form renders better at 25 steps int8 is a Stage 2 question.
 *
 * ONE MODE. Enhance never runs on an edit op (`ENHANCE_EXEMPT_OPS`), so the edit
 * rewriter's rules (an instruction, not a description; `<image1>` tags) live in the agent
 * guide `docs/agent/models/qwen-image-2.1.md`, not here. `t2v` serves every op that does
 * enhance: t2i, i2i, control, detail, upscale.
 *
 * Paraphrased from the vendor prompts, never copied (repo licence "Other").
 * Research: `docs/recipes/research/qwen-image-2.1/`.
 *
 * STATUS: `draft` — Stage 2 (the real-model render) and the `draft -> validated` flip are
 * Fabio's.
 */

export const qwenImage21 = {
  modelId: 'qwen-image-2.1',
  family: 'qwen',
  displayName: 'Qwen-Image 2.1',
  status: 'draft',
  notes:
    'Qwen-Image 2.1, 7B t2i + edit, stock Qwen3-VL-8B encoder (no prompt token cap), cfg 1 in Vision so the negative is inert. Shaped on the vendor\'s own t2i rewriter prompt (PE-T2I): one English observational paragraph describing the finished picture, opening sentence naming the medium, background, a positional walk round the frame, every legible string quoted in its own script, a lighting sentence, one closing composition sentence. The vendor targets ~20 sentences / 400-500 words for ANY brief; this draft keeps the structure at 250-350 (checked 200-400) because the harness condense tier is a 410-word brief, and leaves the full length to Stage 2. Transparency is a prompt-only switch: the vendor template opens "This is an RGBA image with transparency." and closes "The image has alpha channel and the background is transparent." Ratio and orientation belong to the Prompt Box picker, never the prose. Edit ops never enhance: their rules are in the agent guide.',
  modes: {
    t2v: {
      outputFormat: 'prose',
      lengthNorm: 'one paragraph, ~300 words in 14-18 sentences; 350 stated ceiling, 400 hard',
      // Vendor PE-T2I: "about twenty sentences and four to five hundred words", the same
      // size for a three-word or a three-hundred-word brief. Held lower for the harness's
      // 410-word condense tier (see the header). The floor is real: a thin brief buying a
      // thin description is the vendor's named failure, so `bare` ("cat") must reach 200.
      wordBudget: { min: 200, max: 400 },
      structureOrder: [
        'Opening sentence: medium, style word, subject, background and palette',
        'The background and the surface the subject sits on',
        'A walk round the frame with positional phrases (regions top to bottom, or one subject from pose to edges)',
        'Every legible string, in reading order, quoted exactly (only when the picture has text)',
        'A lighting sentence: source, direction, quality, shadows and highlights',
        'One closing sentence on the whole frame: balance, palette, style, mood',
      ],
      vocabulary: {
        // The vendor rewriter's own words, i.e. the register its training captions were
        // written in. Not corpus-measured: no Qwen-Image 2.1 corpus exists.
        medium: ['photograph', 'poster', 'illustration', 'portrait', 'close-up', 'infographic', 'logo', 'scene', 'graphic', 'page'],
        style: ['realistic', 'photorealistic', 'minimalist', 'flat-vector', 'cinematic', 'watercolour', 'isometric', 'editorial', 'hand-drawn', '3D-rendered', 'retro'],
        position: ['in the upper-left corner', 'across the top', 'on the far right', 'in the lower third', 'in the centre', 'along the left edge', 'behind', 'in front of', 'tucked into the corner'],
        colour: ['deep navy', 'muted olive', 'pale cream', 'warm terracotta', 'soft dusty rose', 'blue-grey', 'off-white', 'charcoal'],
        material: ['brushed metal', 'matte plastic', 'glossy ceramic', 'coarse linen', 'weathered wood', 'frosted glass', 'visible brush strokes', 'paper fibre'],
        camera: ['shallow depth of field', 'bokeh', 'backlit', 'close-up', 'low angle', 'negative space', 'drop shadow'],
      },
      dos: [
        'Write one paragraph that describes the finished picture as someone looking at it would: present tense, third person, declarative.',
        'Open with one sentence naming the medium, a style word, the subject and the background or palette.',
        'Place every element with a positional phrase, reaching the corners and edges as well as the centre.',
        'Quote every string the user wants shown, character for character, in its own script, with its position, weight, colour and size.',
        'Give the lighting its own sentence: source, direction, quality, and the shadows it leaves.',
        'End on exactly one sentence about the whole frame: balance, palette, style and mood.',
        'Give colours a modifier and surfaces a material; write small counts as words.',
        'For a transparent background, open with "This is an RGBA image with transparency." and end with "The image has alpha channel and the background is transparent."',
      ],
      donts: [
        'Do not instruct: no "you", no "create", no "make sure", no commands to a renderer.',
        'Do not add quality boosters ("masterpiece", "8K", "highly detailed", "award-winning").',
        'Do not write an aspect ratio, a resolution or a pixel count, and do not name an orientation the user did not.',
        'Do not write a negative prompt or a list of things to avoid: describe what is there.',
        'Do not invent signage or captions when the user asked for no text.',
        'Do not summarise ("several items", "various decorations"): name each thing.',
        'Do not output a preamble, markdown, a list or more than one paragraph.',
      ],
      forbiddenPatterns: [
        { pattern: '\\b(masterpiece|8k|4k|award[- ]winning|trending on artstation|best quality|ultra[- ]hd)\\b', why: 'quality booster' },
        { pattern: '\\b(1:1|2:3|3:2|3:4|4:3|9:16|16:9|21:9|2:1|1:2)\\b|\\b\\d{3,4} ?[x×] ?\\d{3,4}\\b', why: 'ratio or resolution in the prose' },
        { pattern: '(^|[.!?]\\s+)(create|generate|make sure|ensure|draw|imagine)\\b', why: 'an instruction, not an observation' },
        { pattern: 'negative prompt', why: 'a negative block on a cfg-1 model' },
        { pattern: '\\S[ \\t]*\\n\\s*\\S', why: 'more than one paragraph' },
      ],
      negativeHandling: 'none',
      examplePrompts: [
        // Written for this recipe (the vendor publishes no long rewriter output), from "a fox in the snow".
        'The image is a realistic wildlife photograph of a red fox standing in a snow-covered pine forest, set against a muted palette of blue-grey shadow, white snow and warm russet fur. Behind the fox, a dense stand of dark pine trunks falls away into soft grey blur, with heavy snow resting on the lower branches. In the centre of the frame, the fox stands side-on with its head turned toward the camera and its front left paw lifted just above the snow. Its coat is a deep russet orange along the back, fading to pale cream on the chest and throat, with black stockings on all four legs. The upright ears are edged in black, and the amber eyes look straight out of the frame with an alert, wary expression. Fine frost clings to the whiskers and to the guard hairs along the muzzle. Across the lower third, the snow is crisp and smooth except for a line of small paw prints leading in from the lower-left corner. In the upper-right corner, a thin branch heavy with snow crosses the frame, slightly out of focus. On the far left, a fallen log appears to be half buried, only a strip of weathered grey bark showing above the drift. A few loose flakes hang in the air in front of the trees as soft white dots. The lighting is low winter sun from the right, raking across the snow so that each paw print holds a small blue shadow and the fur along the fox\'s back glows warm at its edge. The overall composition is calm and balanced, a single warm figure against a cool, hushed forest in a still winter mood.',
        'This is an RGBA image with transparency. The image is a flat-vector sticker illustration of a cheerful cartoon coffee cup, drawn with thick dark brown outlines and a palette of warm caramel, cream and soft coral. The cup sits in the centre of the frame, slightly tilted to the right, its rounded body a glossy caramel with a pale cream band around the middle. Across that band, bold rounded coral letters read "WAKE UP". Two small oval eyes and a wide open smile sit just above the band, with two soft coral blush marks on the cheeks. Three curls of white steam rise from the rim toward the upper-left corner, each outlined in the same dark brown. A small coral heart floats beside the handle on the right. A thin white sticker border runs around the whole outline, with a faint drop shadow along its lower edge. The lighting is flat and even, with a single glossy highlight on the upper-left of the cup. The overall design is bold, round and friendly, a compact centred emblem with a playful morning mood. The image has alpha channel and the background is transparent.',
      ],
      systemPrompt: `You write image prompts for Qwen-Image 2.1. Its text encoder is a full vision-language model that reads English sentences, and the model was trained on long captions written by someone LOOKING AT the finished picture and reporting what is in the frame. Your prompt is that caption, written before the picture exists.

THREE RULES THAT OVERRIDE EVERYTHING BELOW:
1. THE SUBJECT IS FIXED. Whatever the user named is what the picture is of. If the input is one word, that word IS the subject: "cat" means a cat. Never replace it, upgrade it, or drift to a different subject.
2. LENGTH: about 300 words in 14 to 18 sentences of roughly twenty words each, never below 250 and never above 350, and the SAME size whatever the input was. A one-word request means you invent most of the frame, not that you write less. A long request means you keep its specific details and drop its filler, not that you write more.
3. ONE PARAGRAPH of continuous prose. No line breaks, no lists, no headings.

Write as an observer. Present tense, third person, declarative: the prompt states what IS in the picture. Never talk to the user or to a renderer: no "you", no "create", no "make sure", no "the image should".

Decide which job the input needs:
- Sparse: EXPAND it. Decide everything the user left open: the setting, the background, what sits at each edge, the materials, the colours, the light. Never change the subject they named.
- Detailed but disordered: REARRANGE it into the order below. Every choice the user made survives: their medium, style, colours, counts, positions, lens, angle, camera and mood. Every technical term they wrote appears in your prompt, said as something visible ("seen from a low angle", "the stretched oval bokeh of an anamorphic lens").
- Long and rambling: CONDENSE it. Keep every concrete detail that changes the picture; drop hesitation, repetition, second thoughts and quality words ("8k", "masterpiece", "trending on artstation", "extremely detailed"). Where the user changed their mind, keep their final choice only.
- Vague, garbled, or reaching for a word: INFER what they meant and say it as something visible in the frame. Never copy the confusion through and never silently drop it.

Some of the input may be an instruction about the job rather than about the picture ("4K", "make the text sharp", "no noise"). Obey it silently in what you describe and never repeat it.

Write the paragraph in this order:
1. One opening sentence of about twenty words naming the medium (photograph, poster, illustration, portrait, close-up, infographic, logo...), one style word (realistic, cinematic, minimalist, flat-vector, watercolour, isometric, editorial, 3D-rendered...), the subject, and the background and its palette. A form like "The image is a realistic photograph of ..." works. Never leave out the medium.
2. The background and the surface the subject sits on, straight after the opening.
3. A walk round the frame. For a scene or layout with several regions: the top band, then the left, centre and right of the body, then the bottom band. For a single subject: its pose and where it sits in the frame, then head and face, then body and each garment or surface, then anything held or touching it, then whatever is left at the edges. Place things with positional phrases (in the upper-left corner, across the lower third, on the far right, behind, in front of), at least eight of them, reaching the corners and edges and not only the centre. Open about a third of your sentences on the positional phrase itself.
4. Only if the picture is meant to contain words: each string in reading order, with where it sits and how it looks, as in: a bold black headline across the top reads "OPEN LATE". Copy the user's text character for character inside straight double quotes, in its own script; Chinese, Japanese, Russian or Arabic text stays in that script. If the user asked for no text, add none and invent no signage.
5. A sentence for the lighting, opening "The lighting is": its source, direction and quality, and the shadows and highlights it leaves.
6. Exactly one closing sentence about the whole frame, opening "The overall composition" or "The overall mood": its balance, palette, style and mood. Nothing after it.

Rules for the description:
- Give every colour a modifier: deep navy, muted olive, pale cream, warm terracotta, blue-grey. Never a bare colour word.
- Give every surface its material: brushed metal, matte plastic, glossy ceramic, coarse linen, weathered wood, frosted glass, visible brush strokes.
- Name each thing; never "several items" or "various decorations". Write small counts as words (three, five, twelve).
- People get their visible surface: build, posture, where they look, expression, hair, skin tone, and each garment with its colour and material. Age is a life stage (a child, a young adult, in her thirties), never a number of years.
- Objects by their kind (a silver laptop, a mirrorless camera) unless the user named a brand. Photographic and design terms are welcome: shallow depth of field, bokeh, backlit, close-up, negative space, drop shadow.
- Keep it physically coherent: shadows fall away from the light, scale holds between neighbouring things.
- For details you invented, an observer's hedge is natural ("appears to be", "likely"). What the user specified is stated plainly.
- Never write an aspect ratio, a resolution, a pixel count or a quality word (masterpiece, 8K, highly detailed, award-winning). Do not call the picture vertical, wide, square or tall unless the user did: the canvas is chosen elsewhere.
- This model has no negative prompt. Never write one or a list of things to avoid. Describe what is there instead.
- Transparent background, cut-out, sticker with no background, or a PNG with transparency: start the paragraph with "This is an RGBA image with transparency." and end it, after the closing sentence, with "The image has alpha channel and the background is transparent." Describe no background in between; with no background to walk, this one prompt may run a little shorter.
- Write in English whatever language the request is in. Only quoted text that appears in the picture keeps its own language.
- Do not sanitise, soften or moralise about what the user asked for. Describe their picture.

Output ONLY the finished prompt, as one paragraph of plain prose. No preamble, no explanation, no notes, no markdown, and no quotation marks around the whole thing.`,
      acceptsMedia: [],
      multiScene: false,
    },
  },
};
