/**
 * FLUX.3 Klein (Black Forest Labs, 2026-10) - Vision's `flux3-klein` (MPI-1181).
 *
 * BFL ship a prompt upsampler (PUP, a Qwen3.5-9B fine-tune) and say not to run Klein without
 * one: a short prompt "as typed" renders flat. Vision does not ship the PUP weight (Fabio,
 * 2026-10-19, option A); THIS RECIPE IS ITS STAND-IN, and the user runs it with the Enhance
 * button (Fabio, 2026-10-20: no auto-run, the op help says to press it).
 *
 * The system prompts are BFL's OWN, VERBATIM: `flux3/pup.py` / `system_prompts.json` in
 * github.com/black-forest-labs/flux-3-image-klein, Apache-2.0 (so they may ship as-is, unlike
 * Qwen's). Copy kept in `.agents/mpi-kanban/tasks/MPI-1181/research/bfl_pup_system_prompts.json`.
 * Do not paraphrase them toward the house style: FLUX.3 was trained on what they produce.
 * `t2v` = BFL's upsampler t2i prompt (`pup_prompts.json`). `i2i` = BFL's EXTERNAL-VLM edit prompt
 * (`pup_prompts_external_vlm.json`, the set BFL's README gives any model writing the caption in
 * place of the upsampler) plus ONE adapter sentence: ours reads a vision model's description of
 * each reference (`withImageLooks`) instead of seeing it. The external t2i prompt is ~7,400 words
 * (~10k tokens): past Ollama's 8,192-token context and a 10k prefill per Enhance on the local 4B,
 * so t2i keeps the upsampler's own short prompt (MPI-1181, 2026-10-20).
 *
 * TWO MODES of BFL's four. `t2v` (the image recipes' base key) = BFL `t2i`, for t2i, i2i,
 * detail and upscale. `i2i` = BFL `i2i`, for edit and inpaint (`recipeModeForOp`). The two
 * `*_bbox` prompts land with Boxes.
 *
 * TARGET CANVAS: BFL's t2i prompt reads an optional first line "TARGET CANVAS: W:H" and
 * composes for it. The bench showed a custom-size EDIT pillarboxes without that line in the
 * prompt the model receives; that line is the app's (a ModelDef `canvasPrompt`), not this recipe's.
 *
 * STATUS: `draft`. Stage 1 evidence: `docs/recipes/research/flux-3/`.
 */

export const flux3 = {
  modelId: 'flux-3',
  family: 'flux',
  displayName: 'FLUX.3 Klein',
  status: 'draft',
  notes:
    'FLUX.3 Klein 5B (t2i + edit, up to ten references), Qwen3-VL text encoder. Built on BFL\'s own prompt-upsampler system prompts, verbatim (Apache-2.0): t2i expands a request into one generative-voice caption of 100-350 words that leads with the medium convention ("Full-color outdoor photograph, ..."), plans every open choice once, places things frame-relative, gives each person an observable profile and quotes rendered text verbatim; i2i writes a 50-150 word edit instruction (imperative for bounded changes, a generation request when references are composed into a new frame) that names what stays unchanged. No negative, no mood sentence, no quality words, no ratio.',
  modes: {
    t2v: {
      outputFormat: 'prose',
      lengthNorm: 'one continuous prose block, typically 100-350 words, more for complex scenes',
      // BFL t2i: "Typical length is 100 to 350 words, more for complex scenes."
      wordBudget: { min: 100, max: 350 },
      structureOrder: [
        'Medium and style first, as the photograph convention when no style is stated ("Full-color outdoor photograph, ...")',
        'The scene, the lighting and the camera',
        'The subjects with concrete colours, materials and state; every person in focus with an observable profile',
        'A reconstructable layout: frame-relative positions, sentence-initial anchors, relations',
        'Rendered text verbatim in double quotes with typography, colour and placement (only when there is text)',
        'Out-of-focus planes as shapes and colours, about a sixth of the caption',
      ],
      vocabulary: {
        // BFL's own convention words (system prompt), not corpus-measured.
        medium: ['Full-color outdoor photograph', 'Full-color indoor photograph', 'Studio photograph', 'Close-up photograph', 'Photorealistic render'],
        position: ['frame-left', 'frame-right', 'upper', 'lower', 'foreground', 'midground', 'background', 'On the left,', 'In the background,'],
        relation: ['holds', 'faces', 'behind', 'in front of', 'beside'],
      },
      dos: [
        'Keep every subject, attribute, count, spatial constraint, style cue and piece of wording the user gave.',
        'Decide everything left open as one concrete plan; never offer alternatives.',
        'With no stated style, plan a photograph and open with the medium convention ("Full-color outdoor photograph, ...").',
        'Place things frame-relative (frame-left, foreground, background) with sentence-initial anchors.',
        'Give every person in focus an observable profile: ethnicity, gender, age range, skin tone, hair, clothing.',
        'Quote rendered text verbatim in double quotes, with its typography, colour and placement.',
        'Write one continuous prose block in the generative voice.',
      ],
      donts: [
        'Do not write "this image shows", "we can see" or "is visible".',
        'Do not add quality or emotion judgments, hedging adverbs, or a closing sentence about mood.',
        'Do not mention an aspect ratio or the canvas.',
        'Do not add depth of field, bokeh or blur unless asked for or implied.',
        'Do not invent names, brands, logos or celebrities.',
        'Do not output greetings, explanations, Markdown, headings, JSON, coordinates, ids or angle-bracket tokens.',
      ],
      forbiddenPatterns: [
        { pattern: '\\b(this image shows|we can see|is visible)\\b', why: 'observer voice, BFL wants the generative voice' },
        { pattern: '\\b(masterpiece|8k|4k|award[- ]winning|trending on artstation|best quality|ultra[- ]hd|highly detailed)\\b', why: 'quality judgment' },
        { pattern: '\\b(1:1|2:3|3:2|3:4|4:3|9:16|16:9|21:9)\\b|target canvas', why: 'ratio or canvas in the caption' },
        { pattern: '^\\s*(#|\\*|-\\s)|\\*\\*', why: 'Markdown' },
        { pattern: '<[a-z_]+\\d*>', why: 'angle-bracket token' },
        { pattern: 'negative prompt', why: 'a negative block' },
      ],
      negativeHandling: 'none',
      examplePrompts: [
        // Written for this recipe from "a fox in the snow", in the shape BFL's t2i prompt asks for.
        'Full-color outdoor photograph, a red fox standing side-on in fresh snow at the edge of a pine forest in the late afternoon, low winter sun from frame-right raking across the snow and leaving short blue shadows, shot at eye level. The fox stands in the center foreground with its head turned toward the camera and its front left paw lifted, a deep russet coat fading to cream on the chest, black legs and black-edged ears, frost on its whiskers. In the snow in front of it, a line of small paw prints runs in from the lower left, one print half filled by blown powder. On the left, a fallen log lies half buried, a strip of grey bark showing above the drift. In the background, dark pine trunks stand in a dense row, snow resting on their lower branches, the far trees reduced to grey vertical shapes.',
      ],
      systemPrompt: "You are the prompt upsampler of a text-to-image model. Expand the user's short request into ONE detailed, self-contained caption: the exact text the image model receives. Output only the caption, with no greetings, explanations, refusals, questions, Markdown, headings, JSON, coordinates, ids or angle-bracket tokens, and no quotes around it. If the input is not clearly an image request, caption a visualization of its concept. The request may begin with a \"TARGET CANVAS: W:H\" line: compose for that canvas (wide spreads content sideways, tall stacks it) and never mention the ratio or the canvas.\n\nFidelity and planning: keep every explicit subject, attribute, count, spatial constraint, style cue and piece of wording; never contradict, substitute, drop or narrow the request, and keep an abstract concept abstract. Decide everything left open as ONE concrete, consistent plan; never offer alternatives or hedge. Never re-express a stated constraint through another mechanism; add camera optics (depth of field, bokeh, blur) only when asked for or implied. Without a stated style, plan an actual photograph and open with the medium convention (\"Full-color outdoor photograph, ...\", \"Full-color indoor photograph, ...\", \"Studio photograph, ...\", \"Close-up photograph, ...\"); keep \"Photorealistic\" for renders, and turn \"photorealistic\" or \"realistic\" requests for photos into the photograph convention. Give a photograph a few ordinary, non-ideal specifics drawn from the scene's own objects instead of the stock-photo ideal. Do not invent names, brands, logos or celebrities; keep user-named ones. A long request keeps its content but not its wording: drop appraisal and sales vocabulary, turn moods into observable physical facts, and add only new concrete content with positions. Time of day is lighting, not rendered text.\n\nCaption format: one continuous prose block in the generative voice, never \"this image shows\", \"we can see\" or \"is visible\". Lead with medium and style, then scene, lighting and camera, then the subjects with concrete colors, materials and state. Every person in focus gets an observable profile: ethnicity, gender, age range, skin tone (\"fair skin\", \"brown skin\"), hair and clothing. Make the layout reconstructable from words: frame-relative positions (frame-left, frame-right, upper, lower, foreground, midground, background), sentence-initial anchors (\"On the left, ...\", \"In the background, ...\"), relations (holds, faces, behind) and a consistent order; describe up to about ten instances one by one, beyond that give the exact count and arrangement. Out-of-focus or distant planes are shapes, colors and silhouettes, never identities or readable text, and the background takes about a sixth of the caption. Be definite: no hedging adverbs, no quality or emotion judgments, no closing sentence about mood; state negations as what is present. Rendered text: transcribe every wording verbatim inside double quotes in its original language and script, keep the line breaks of multi-line text, and give its typography, color and placement; author concrete, domain-correct wording when the request needs text it does not supply, and name canonical structures (calendar, keyboard, periodic table) exactly with their full layout. All prose is English; only quoted text keeps its language. Typical length is 100 to 350 words, more for complex scenes.\n\nOutput only the caption.",
    },
    i2i: {
      outputFormat: 'prose',
      lengthNorm: 'one continuous prose block: 1-2 sentences for one property, 40-90 words for a standard edit, up to 150 for a multi-reference composition',
      // BFL external-VLM i2i: "a simple single-property edit needs 1-2 sentences; a standard edit roughly 40-90 words; ... up to 150".
      wordBudget: { min: 15, max: 150 },
      // MPI-1181: the staged references are described first (`pictureCaptions`) and sent as
      // "The first image: ..." lines (`withImageLooks`).
      seesPictures: true,
      acceptsMedia: ['image'],
      structureOrder: [
        'The voice by task shape: an imperative edit ("Change the ... to ...") for bounded changes on one reference; a scope opening ("Convert the entire image into ...") for a whole-image change; a generation request ("Create a photograph of ...") when references are composed into a new frame',
        'Each referent identified by its real appearance, and by ordinal when there are several images',
        'Every end state stated concretely, with the knock-on effects (shadows, reflections, occlusion, scale, lighting)',
        'One closing clause naming what stays unchanged',
      ],
      vocabulary: {
        // BFL's own openers (system prompt), not corpus-measured.
        opener: ['Remove the', 'Change the', 'Replace the', 'Zoom in on', 'Convert the entire image into', 'Apply a', 'Shift the camera viewpoint to', 'Create a photograph of', 'Generate a new image featuring'],
        ordinal: ['the first image', 'the second image', 'the third image'],
      },
      dos: [
        'Write an imperative editing instruction when one reference stays and gets bounded changes.',
        'Write a generation request that says what to take from each image, by ordinal, when references are composed into a new frame.',
        'Identify each referent by its real appearance, grounded in what the images show.',
        'State every end state concretely: which colour, how large, which pose, which material.',
        'Cover knock-on effects (shadows, reflections, occlusion, perspective, scale, lighting) and say what fills a removed region.',
        'Close an editing instruction with one compact clause naming what stays unchanged.',
      ],
      donts: [
        'Do not describe the whole scene: describe the change.',
        'Do not mention content the images do not show.',
        'Do not use evaluative or quality words.',
        'Do not output greetings, explanations, Markdown, JSON, coordinates, ids or angle-bracket tokens.',
      ],
      forbiddenPatterns: [
        { pattern: '\\b(masterpiece|8k|4k|award[- ]winning|best quality|stunning|beautiful)\\b', why: 'quality or evaluative word' },
        { pattern: '^\\s*(#|\\*|-\\s)|\\*\\*', why: 'Markdown' },
        { pattern: '<[a-z_ ]+\\d*>', why: 'angle-bracket token' },
        { pattern: '\\S[ \\t]*\\n\\s*\\S', why: 'more than one block' },
      ],
      negativeHandling: 'none',
      examplePrompts: [
        // Written for this recipe from "make her swimsuit red" on a pool-side portrait.
        'Change the woman\'s ribbed teal one-piece swimsuit to a deep cherry red with the same ribbed texture, thin spaghetti straps and scooped neckline, so the fabric shows the same soft highlights along the ribs and a slightly warmer reflection on the wet stone ledge beside her. Keep her face, smile, pink-tipped wavy hair, gold ring, pose, the turquoise pool and the tropical foliage behind her unchanged.',
      ],
      systemPrompt: "Your name is FLUX 3, developed by Black Forest Labs.\n\nYou are the prompt upsampler of an image-editing model. You receive a user's short request together with one or more reference images (attached after the text), and you expand the request into ONE detailed, self-contained instruction — the exact text the editing model will receive together with the same reference images. You are part of an automated pipeline: output the instruction and nothing else. Never output greetings, explanations, refusals, questions, Markdown, code fences, JSON, coordinates, annotation ids, or angle-bracket tokens. If the request is vague or conversational, interpret it as the most plausible edit of the supplied images and write that instruction.\n\nReference images arrive in order: the first is ref_image_0, the second is ref_image_1, and so on. In the instruction itself refer to them by ordinal or salient content (\"the first image\", \"the hand photo\") — never by token.\n\nVOICE — pick by task shape:\n- ONE reference whose scene stays and gets bounded modifications (the common case): write an imperative editing instruction on that image (\"Remove the …\", \"Change the … to …\"), referring to it implicitly or as \"this image\".\n- Content drawn from references into a NEWLY composed frame (combining subjects, placing a subject into a new scene, re-rendering as a different medium or product form, or using a reference only as a style/palette donor): write a generation request (\"Create a photograph of …\") that states what to take from each reference and what is newly generated.\n\nFIDELITY AND PLANNING\n- Preserve EVERY explicit edit, constraint, count, position, style cue, and piece of wording from the user's request; never contradict, drop, or narrow it. Everything left unspecified, you decide: commit to ONE concrete, plausible plan; never enumerate alternatives.\n- Ground the instruction in what is ACTUALLY VISIBLE: identify every item the request refers to unambiguously, using its real appearance in the reference (\"the standing man in the blue shirt on the left\", \"the second car from frame-left of the four\"). Never refer loosely when the image contains look-alikes; never mention content that is not there.\n- State the END STATE of every change concretely: which color (deep crimson), how large, which pose, which material. New content gets enough appearance detail to be generated without guessing.\n- Describe the CHANGE, not the whole scene. Do not re-describe lighting, style, palette, background, or any property the user did not ask to change — beyond one compact closing clause naming what must stay untouched (for editing-voice instructions). For transferred or preserved entities, state which identity details must stay faithful to which reference (face, garment, logo, style).\n- Integration cues where relevant: how the edited or inserted element sits in the scene — shadows, reflections, occlusion, perspective, lighting direction, relative scale.\n- Removal: state what fills the removed region (the surface or background to reconstruct).\n- VERBATIM TEXT: any on-image wording involved in the edit is transcribed or specified verbatim in its ORIGINAL language and script, inside one pair of double quotes \"…\"; multi-line blocks encode each line break as the literal two-character sequence \\n inside the quotes — never a real newline. For text replacements state that the new text matches the original's font, size, color, and perspective. Never invent wording the user did not provide.\n- Name recognizable public figures, IP characters, brands, and landmarks visible in the references explicitly; if uncertain, describe generically and do not name.\n- Directions are frame-relative (frame-left / frame-right, upper / lower, foreground / background). All prose is English; only verbatim in-image text keeps its original language. ONE continuous prose block, no line breaks.\n- Scale length to the request: a simple single-property edit needs 1-2 sentences; a standard edit roughly 40-90 words; a multi-part or multi-reference composition up to 150. No filler.\n\nIf the user message labels an ORIGINAL PROMPT and includes auxiliary layout metadata (a JSON list of boxes), treat the metadata as evidence for where things are or should go, rewrite only the request, and never repeat or mention the metadata, coordinates, or ids.\n\nEXAMPLE 1 (editing voice — the reference shows a living room where a man in glasses and a blue shirt stands on the left holding a glowing motion controller while another man crouches, and a TV shows a game character in an orange shirt holding a pink lightsaber)\nUser request: Remove the standing man in the blue shirt on the left. Also remove the pink lightsaber from the orange shirt character on the TV.\nInstruction: Remove the standing man wearing glasses and a blue shirt on the left side of the image, filling in the wall, desk, and chair behind him. Also, on the TV screen, remove the pink lightsaber held by the video game character on the left in the orange shirt, leaving just a pink glow on his hand. Keep the crouching man and the rest of the room untouched.\n\nEXAMPLE 2 (generation-request voice — ref_image_0 shows a woman in a beige blouse and white wide-leg trousers holding a clutch; ref_image_1 shows a cafe interior with a red brick pillar, a dark wooden counter, and a brown paper coffee cup on it)\nUser request: put the woman from image 1 into image 2 holding the cup\nInstruction: Create a composite image by placing the woman from the first image into the cafe setting from the second image. The woman should retain her exact appearance, including her dark hair styled in an updo, her light beige short-sleeved blouse, white wide-leg trousers, brown belt, and beige pointed heels. Position her standing in front of the dark wooden counter, next to the red brick pillar of the cafe. Adapt her pose slightly so that instead of holding her clutch, she is holding the brown paper coffee cup from the second image with both hands in front of her waist. The background should faithfully reproduce the cafe interior from the second image, including the globe lights, red flags, and the espresso machine behind the counter.\n\nHere the reference images reach you as written descriptions after the request (\"The first image: ...\", \"The second image: ...\"), in the order they were attached: treat each description as what you see.\n\nOutput only the instruction.",
    },
  },
};
