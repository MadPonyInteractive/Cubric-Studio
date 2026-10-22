/**
 * MOSS-Image (OpenMOSS, 2026-10) - Vision's `moss-image` (MPI-1243), t2i only.
 *
 * MOSS-Image was trained on captions that DESCRIBE a finished image (OpenMOSS USERGUIDE § Image
 * Captioning: composition, subjects, setting, colours, lighting, style, every visible text
 * verbatim with its layout). Its strength is lettering, so the recipe's weight is on quoting and
 * placing text.
 *
 * The system prompt is the one Comfy-Org ship in the official ComfyUI MOSS templates
 * (`image_moss_image_t2i.json`, the TextGenerate "System prompt" node; comfyui-workflow-templates
 * 0.1.115, MIT), VERBATIM, which their note says is "written from the official MOSS-Image Prompt
 * Enhancer skill" (github.com/OpenMOSS/MOSS-Image `skills/moss-image-prompt-enhancer/`, Apache-2.0).
 * It runs on MOSS's own text encoder in that template; here on the app's enhancer model.
 *
 * ONE adapter paragraph sits before its last line: the condense and infer-intent jobs. The
 * template prompt says "keep everything the user specified", which on a rambling request keeps
 * the rambling, and it is silent on a garbled one.
 *
 * ONE MODE, `t2v` (the image recipes' base key). There is no box mode: with Boxes drawn the app
 * sends the request with a PLACEMENT list (`editPlacementInput`), this mode writes the caption, and
 * the dispatch wraps it as `summary.caption` of MOSS's layout JSON (`mossLayoutPrompt`,
 * `js/data/layoutBoxes.js`). The vendor skill's own Layout deliverable is the app's job, not this.
 *
 * No negative: the template prompt says "no negative prompt", and Vision never defaults the
 * vendor's `nsfw, ...` negative (docs/models/moss/README.md § Hard rules).
 *
 * STATUS: `draft`. Stage 1 evidence: `docs/recipes/research/moss-image/`.
 */

export const mossImage = {
    modelId: 'moss-image',
    family: 'moss',
    displayName: 'MOSS-Image',
    status: 'draft',
    notes:
        'MOSS-Image 5B (OpenMOSS), text-to-image, trained on descriptive captions and strongest at exact lettering. Built on the Comfy-Org ComfyUI template\'s prompt-upsampler system prompt, verbatim (MIT, itself written from OpenMOSS\'s prompt-enhancer skill): one to three paragraphs of plain English prose, 80-200 words, that describe the finished image (medium and main subject first, then setting and composition, then lighting, colours and detail), quote every visible text exactly in double quotes with its position and type, and give positions in words. No coordinates, lists, JSON, quality keywords or negative.',
    modes: {
        t2v: {
            outputFormat: 'prose',
            lengthNorm: 'one to three paragraphs of plain prose, usually 80-200 words, longer only when there is a lot of text to place',
            // Comfy-Org template: "one to three paragraphs, usually 80 to 200 words".
            wordBudget: { min: 80, max: 200 },
            structureOrder: [
                'The medium and the main subject',
                'The setting and the composition: framing, viewpoint, positions in words',
                'Lighting, colours, materials and finer details',
                'Every visible text quoted exactly, with where it sits and how it looks (only when there is text)',
            ],
            vocabulary: {
                // The template prompt's own position words, not corpus-measured.
                position: ['left', 'right', 'top', 'bottom', 'foreground', 'background', 'centre'],
            },
            dos: [
                'Keep every subject, count, action, relationship, medium, style, mood, colour and exclusion the user gave.',
                'Fill what the user left open with concrete visual choices: setting, framing, viewpoint, lighting, materials, palette, medium.',
                'Write a description of the finished image, opening with the medium and the main subject.',
                'Quote every visible text exactly in double quotes, with its position, alignment, size, font style and colour.',
                'For a designed image with no text given, write short specific copy that fits.',
                'Give positions in words: left, right, top, bottom, foreground, background.',
            ],
            donts: [
                'Do not write instructions to the model: describe the image itself.',
                'Do not describe sounds, smells, backstory or intentions.',
                'Do not invent dates, prices, names or specifications the user did not give.',
                'Do not translate or change the user\'s wording of text in the image.',
                'Do not mention watermarks or artist signatures.',
                'Do not use quality keywords, coordinates, lists, headings, JSON, Markdown or a negative prompt.',
            ],
            forbiddenPatterns: [
                { pattern: '\\b(masterpiece|best quality|8k|4k|highly detailed|ultra[- ]hd|trending on artstation|award[- ]winning)\\b', why: 'quality keyword' },
                { pattern: '^\\s*(#|\\*|-\\s|\\d+[.)]\\s)|\\*\\*', why: 'Markdown or list' },
                { pattern: '[\\[{]\\s*-?\\d+\\s*,\\s*-?\\d+|"\\w+"\\s*:', why: 'coordinates or JSON' },
                { pattern: '\\b(watermark|signature)\\b', why: 'watermark or signature' },
                { pattern: 'negative prompt', why: 'a negative block' },
                { pattern: '^\\s*(create|generate|make|draw|render|show)\\b', why: 'an instruction, not a description' },
            ],
            negativeHandling: 'none',
            examplePrompts: [
                // Written for this recipe from "a bakery sign for Rosa's", in the shape the template prompt asks for.
                'Daylight street photograph of a small corner bakery seen straight on at eye level, its painted wooden shopfront in deep forest green with cream trim. Above the window a long hand-painted sign reads "ROSA\'S BAKERY" in tall cream serif capitals, centred, with a thin gold outline, and below it on a smaller line "fresh bread since 1962" in a cream script. The large front window in the lower half shows wicker baskets of round sourdough loaves and a tiered stand of glazed cinnamon buns on a pale marble counter. To the right a narrow glass door carries a small white card in the bottom corner that reads "OPEN" in red block letters. Soft overcast light falls evenly across the facade, the cobblestone pavement in the foreground is still damp, and a potted rosemary bush stands by the door on the right.',
            ],
            systemPrompt: "You turn a user's image idea into one detailed caption for a text-to-image model. The model learned from captions that describe finished images, so write the caption as a description of the image itself, not as instructions.\n\nKeep the request\n- Keep everything the user specified: subjects, counts, actions, relationships, medium, style, mood, colors and anything they excluded. Never contradict or drop it.\n- Fill in what they left open with concrete visual choices: setting, composition and framing, viewpoint, lighting, materials and textures, color palette, and the artistic medium.\n- Describe only what can be seen. Leave out sounds, smells, backstory and intentions.\n- Do not invent real-world facts the user did not give, such as specific dates, prices, names or specifications.\n\nText in the image\n- Quote every piece of visible text exactly, in double quotes. Keep the user's wording, language, spelling, capitalization, punctuation and line breaks; never translate it.\n- If the user asks for a designed image (poster, cover, menu, label, sign, infographic) without giving its text, write short, specific copy that fits instead of placeholders.\n- Describe where each text sits and how it looks: position, reading order, alignment, line breaks, relative size, font style, color and spacing.\n- Do not mention watermarks or artist signatures.\n\nWriting\n- Write in English, in plain prose: one to three paragraphs, usually 80 to 200 words, longer only when there is a lot of text to place.\n- Open with the medium and the main subject, then the setting and composition, then lighting, colors and finer details.\n- Give positions with words such as left, right, top, bottom, foreground and background. No coordinates, lists, headings, JSON or Markdown.\n- No quality keywords such as \"masterpiece\", \"best quality\", \"8k\" or \"highly detailed\", and no negative prompt.\n\nLong or unclear requests\n- A long, rambling request keeps its concrete content but not its wording: drop the indecision, the asides and the praise, turn moods into things that can be seen, and still stay within 200 words.\n- A part of the request that is garbled or misspelled is read as what it was most plausibly reaching for, and written as that.\n- A short request still becomes at least 80 words.\n\nReply with the caption only: no title, introduction, explanation or surrounding quotes.",
        },
    },
};
