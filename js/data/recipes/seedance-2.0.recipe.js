/**
 * Recipe: Seedance 2.0 — text-to-video and first-frame image-to-video.
 *
 * STATUS: `draft`. Rebuilt by MPI-911 from `docs/recipes/research/seedance-2.0/sources.md`
 * rows 11-18: ByteDance's own prompt guide first, Higgsfield's Seedance 2.0 director and
 * acting skills where it is silent. The rule inventory and the classification against the
 * blog-sourced draft this replaced live in `.agents/mpi-kanban/tasks/MPI-911/validation.md`.
 * Two of those sources are private third-party text: everything here is our own words.
 *
 * What the sources decided, and why each is shaped the way it is:
 *  - PROSE IN THE VENDOR'S ORDER: subject, action, scene, lighting, camera, style, quality,
 *    constraints. The director skill writes upper-case section labels; the vendor's guide
 *    does not, and it outranks a serving platform. The director's locks (first frame,
 *    blocking, gaze, landmark distance, lighting) sit inside the slot they govern.
 *  - ONE TAKE BY DEFAULT; `Shot 1:` / `Shot 2:` only when cuts are asked for. NO TIMESTAMPS:
 *    the vendor states precise timing (0-3 s) is unstable. That retired this recipe's
 *    `[0s-4s]` timeline, and it rejects the director's `0:00 to 0:03` blocks too.
 *  - LENS AS A DIAGONAL FIELD OF VIEW IN DEGREES, with camera distance and a visible outcome
 *    (director skill, from production use). Millimetres convert on a full-frame diagonal.
 *  - `{}` dialogue, `<>` sound effects, `()` music: the vendor's own symbol table.
 *  - A SHORT QUALITY PHRASE and a constraint tail (subtitle-free, no logo, no watermark), not
 *    the long mandatory suffix the blog sources prescribed.
 *  - No duration, ratio or resolution words: the app sets all three.
 *
 * `i2v` writes for what the app SENDS: the prompt plus one image as `first_frame_image`, and
 * the enhancer never sees that image. So it describes what happens FROM the frame and never
 * re-describes the frame. The `@Image`/`@Video`/`@Audio` reference system is MPI-910's; its
 * rules are recorded in `sources.md` § "Reference notes for MPI-910".
 *
 * Word budgets come from the vendor's own examples (a three-shot case of 234 words, an
 * image-to-video example of 63): see `research.md` § "MPI-911 answers" 1.
 */

// The prompt aims at 220 or under; the ceiling admits the vendor's own longest example (234 words).
// Measured on the enhancer of record: the condense tier lands 191-224.
const T2V_BUDGET = { min: 60, max: 240 };
// SETTLED BY MEASUREMENT, as minimax-h3's floor was: the vendor gives no i2v ceiling (its one example,
// 63 words, leans on the image). Seven one-sentence parts; the enhancer of record's condense tier
// lands 130-171 while every other tier sits at 93-143. The prompt still aims at 100, never over 160.
const I2V_BUDGET = { min: 40, max: 180 };

/** Shared by both modes. The judge grades `donts` as prose; these are objectively wrong. */
const FORBIDDEN = [
  { pattern: '\\b\\d{2,3}\\s?mm\\b(?!\\s+film)', why: 'a focal length in millimetres: Seedance takes the lens as a field of view in degrees' },
  { pattern: '\\bf\\/\\d', why: 'an f-stop: lens metadata is not a control Seedance follows' },
  { pattern: '\\bISO\\s?\\d', why: 'an ISO value: camera metadata is not a control Seedance follows' },
  { pattern: '\\b\\d{1,2}(\\.\\d)?\\s?s?\\s?(-|–|to)\\s?\\d{1,2}(\\.\\d)?\\s?s\\b', why: 'a timestamp range: the vendor calls precise timing unstable; cuts are Shot 1, Shot 2' },
  { pattern: '\\b\\d:\\d\\d\\b', why: 'a clock timestamp: cuts are Shot 1, Shot 2, with no durations' },
  { pattern: '\\b(4K|8K|1080p|720p|480p)\\b', why: 'a resolution: the app sets it' },
  { pattern: '@(Image|Video|Audio)\\s?\\d', why: 'an @ reference tag: the app sends no reference assets' },
  { pattern: 'Global Style', why: 'the retired Global Style block label' },
  { pattern: 'Maintaining face and clothing consistency', why: 'the retired long quality suffix' },
  { pattern: '\\bnegative (prompt|constraints)\\b', why: 'a negative block: constraints are short local locks' },
  // Measured on the first sweep: an 8B enhancer copies the recipe's part names as headings.
  { pattern: '(^|\\n)\\s*(Subject|Action|Scene( and blocking)?|Blocking|Lighting|Camera|Sound|Style( and quality)?|Constraints|Locks)\\s*:', why: 'a section label: the prompt is plain sentences' },
  // Measured: a single take opened with "Shot 1:". A shot label with no second shot is always wrong.
  { pattern: '^(?![\\s\\S]*Shot 2:)[\\s\\S]*Shot 1:', why: 'a lone Shot 1 label: one take carries no shot labels' },
];

const CONSTRAINT_TAIL = 'subtitle-free, no logo, no watermark';

export const seedance20 = {
  modelId: 'seedance-2.0',
  family: 'seedance',
  displayName: 'Seedance 2.0',
  status: 'draft',
  notes:
    'Joint audio-video model. Prose in the vendor order (subject, action, scene, lighting, camera, style, quality, constraints), one continuous take unless cuts are asked for, then Shot 1 / Shot 2 with no timestamps. Lens as diagonal field of view in degrees. {} dialogue, <> sound effects, () music. Sources: the official ByteDance guide, then the Higgsfield director and acting skills (MPI-911). Draft until Stage 2 renders.',
  modes: {
    t2v: {
      outputFormat: 'prose',
      lengthNorm: '60-240 words (aim under 220), one paragraph (about 150); one continuous take unless cuts are asked for',
      wordBudget: T2V_BUDGET,
      structureOrder: [
        'Subject: who or what, named in the opening words, with two or three stable visible features',
        'Action: one main action already under way, with body part, range, speed, force and real physics',
        'Scene and first-frame blocking: place and time, screen position, measured distance to a landmark, body facing and gaze',
        'Lighting: the main source, its direction, the camera side relative to it, what stays in shadow',
        'Camera: shot size, at most one movement, camera height, lens as a field of view in degrees with camera distance',
        'Sound: <sound effects>, (music) only if asked, {spoken lines}',
        'Style and quality: one compact style anchor and a few quality words',
        `Constraints: one or two local locks, ending with "${CONSTRAINT_TAIL}"`,
      ],
      vocabulary: {
        fieldOfView: [
          '47-degree field of view, camera about 4 metres away, natural proportions',
          '84-degree field of view, camera about 1 metre away, foreground larger, surroundings visible to the edges',
          '107-degree field of view, camera under a metre from the foreground, straight lines stay straight',
          '29-degree field of view, camera about 5 metres away, background compressed and soft',
          '18-degree field of view, camera about 7 metres away, thin focus on the eyes',
          '8-degree field of view, camera over 20 metres away, blurred foreground shapes framing the subject',
        ],
        shotSize: ['wide shot', 'medium shot', 'medium close-up', 'close-up', 'extreme close-up', 'two-shot'],
        cameraMove: [
          'fixed camera',
          'slow push-in',
          'slow pull-back',
          'smooth lateral tracking',
          'follows at walking pace',
          'handheld, the operator breathing and settling',
        ],
        blocking: [
          'in the first frame',
          'screen-left',
          'screen-right',
          'in the foreground',
          'within 1 metre of',
          'one hand on',
          'body faces',
          'eyes stay on',
        ],
        lighting: [
          'low sun from camera-right',
          'a single window behind her',
          'the camera on the shadow side',
          'rim light along the shoulders',
          'the face in soft shadow',
          'overhead fluorescent tubes',
        ],
        physics: [
          'weight settles into the heels',
          'the coat swings a beat behind the turn',
          'water sheets off and pools on the deck',
          'the door resists, then gives',
          'dust drifts with the wind',
        ],
        performance: ['jaw tightens', 'breath shortens', 'eyes flick to the door and back', 'shoulders drop', 'stops mid-gesture'],
        sound: ['<boots crunch on gravel>', '<a door clicks shut>', '<distant traffic>', '{Keep walking.}'],
        constraints: [CONSTRAINT_TAIL, 'no duplicate characters', 'her grip stays on the rail throughout'],
      },
      dos: [
        'Name the subject in the opening words with two or three stable visible features, and keep every choice the user made.',
        'Write the action as a state already under way, naming the body part and its range, speed and force, with real physics (weight, contact, follow-through).',
        'Place everything in the first frame: screen-left or screen-right, foreground or background, a measured distance or a contact with a landmark, which way the body faces and where the eyes look.',
        'Name the main light source, its direction, and which side the camera is on relative to it.',
        'Give the lens as a diagonal field of view in degrees with the camera distance, chosen for the content; convert any millimetres the user gave.',
        'Use at most one camera movement per shot.',
        'Write sound effects in <>, spoken lines in {}, and music in () only when the user asked for music.',
        'Close with one or two local locks and the constraint tail: subtitle-free, no logo, no watermark.',
        'Keep one continuous take unless the user asks for cuts; then label them Shot 1:, Shot 2: and name the transition.',
        'Show feeling through visible behaviour (a jaw tightening, breath shortening), never a named emotion.',
      ],
      donts: [
        'Do not give a lens in millimetres, f-stops, ISO or a camera or lens brand.',
        'Do not write timestamps or shot durations.',
        'Do not stack two camera movements in one shot, and do not write contradictory framing such as "close-up wide shot".',
        'Do not use vague distance words (near, around, beside) where the position matters.',
        'Do not state the clip length, aspect ratio or resolution.',
        'Do not add decorative adjectives, or invent a violent or high-speed action the user did not ask for.',
        'Do not write a separate list of things to avoid; a lock states the wanted state first.',
        'Do not use @Image, @Video or @Audio tags, scene numbers, or references to other shots or scenes.',
        'Do not append a long quality suffix.',
        'Do not invent dialogue or music the user did not ask for: {} holds only spoken words, () only requested music.',
        'Do not give two lenses in one shot, or open a single take with a Shot 1 label.',
      ],
      negativeHandling: 'inline-positive',
      forbiddenPatterns: FORBIDDEN,
      examplePrompts: [
        'A grey-bearded fisherman in a yellow oilskin coat hauls a wet net over the side of a small wooden boat, both forearms straining, the heavy net slapping onto the deck and spilling seawater across his boots. A calm grey harbour at dawn; in the first frame he stands screen-left at the stern, body facing the water, eyes on the net, the harbour wall ten metres behind him. Low sun from camera-right rims his shoulders and the wet mesh, while the side of his face toward the camera stays in shadow. Medium shot, slow push-in at chest height, 47-degree field of view, camera about 4 metres away, natural proportions. <rope creaks against the gunwale> <water pours off the net> <gulls far off>. Naturalistic documentary look, fine grain, sharp detail, natural colour, stable picture. His grip stays on the net throughout; subtitle-free, no logo, no watermark.',
        "An old woman in a green cardigan and a teenage boy in a school blazer sit across a wooden chessboard in a park at dusk.\nShot 1: Medium two-shot, fixed camera at table height, 47-degree field of view; the board sits centre frame, the woman screen-left and the boy screen-right, both leaning in. She slides her queen forward with one finger, then sits back and folds her arms. <a wooden piece taps the board>\nShot 2: Hard cut to a close-up of the boy, 29-degree field of view, camera about 5 metres away, the park lights compressed into soft discs behind him. His eyes flick from the board to her face and back; his jaw tightens. He says {That's not fair.}\nWarm low sun from behind the woman, the camera on the shadow side, rim light on both profiles. Quiet realistic drama, sharp, natural colour, stable picture. The pieces stay where they were across the cut; no duplicate characters; subtitle-free, no logo, no watermark.",
      ],
      systemPrompt: `You write prompts for Seedance 2.0, a text-to-video model that also makes the sound. It follows plain, concrete, measurable instructions and ignores decorative adjectives. Rewrite the user's idea as one Seedance 2.0 prompt.

TWO RULES THAT OVERRIDE EVERYTHING BELOW:
1. THE SUBJECT IS FIXED. Whatever the user named is what the video shows. If the input is one word, that word IS the subject: "cat" means a cat. Never replace it or upgrade it to something grander.
2. ONE PROMPT, ONE PARAGRAPH, ABOUT 150 WORDS. Write a single paragraph of plain sentences, at least 80 words and never more than 220. Write it once: no variations, no alternatives, no second version, no headings, no quotation marks around it, and no "Shot" labels unless the user asked for cuts.

The four jobs:
- A thin idea: EXPAND it. Keep the user's subject and add control detail: where things stand, where the light comes from, which lens and which move.
- A scrambled idea: REARRANGE it into the order below. Every choice the user made (subject, setting, style, a lens, a move, an angle) must survive.
- A long idea: CONDENSE it. Read it once and note only the subject, the setting, the main action and the camera. Then set the input aside and write the paragraph from those notes. Never walk the input clause by clause keeping what you pass. A long brief will not fit, and that is the point: keep one subject with two or three features, one action, the place in one clause, the light and the camera, and throw the rest away, including detail you like. The result is about 130 words, shorter than an expanded thin idea. Drop repeats, quality spam ("8k", "masterpiece", "extremely detailed") and decoration.
- A garbled or vague idea: INFER what the user was reaching for and write that.

Every prompt covers every step below, one or two sentences each, even when the user gave only one of them: supplying a missing step is the job, not an invention.
- Open with the subject, named in the first words, with two or three stable visible features (age, build, clothing, material). A person's feeling shows in the body (a jaw tightens, the breath shortens), never as a named emotion.
- Then the main action, already under way: the body part, how far, how fast, how hard, and real physics (weight, contact, follow-through, cloth moving a beat behind). Prefer steady, continuous movement; keep a fast or violent action only when the user asked for it.
- Then the place and time, and where everything is in the very first frame: screen-left or screen-right, foreground or background, a distance in metres or a contact with a landmark, which way the body faces and where the eyes look.
- Then the light: the main source, the direction it comes from, which side the camera is on, and what stays in shadow.
- Then the camera: one shot size, one movement at most, the camera height, and ONE lens written as "N-degree field of view" with the camera distance, never a second one. Pick the degrees by content: 47 for natural action, 84 for a wide place, 29 for a portrait, 18 for a tight face. Only if the user wrote a focal length, replace it with its degrees (24 becomes 84, 35 becomes 63, 50 becomes 47, 85 becomes 29, 135 becomes 18): write the degrees alone, never the focal length and never the word "equivalent".
- Then the sound: only what is physically heard, as sound effects in angle brackets like <boots crunch on gravel>.
- Then the style: one short style anchor and a few quality words, such as "sharp, natural colour, stable picture".
- Close with one short lock stating the wanted state ("her grip stays on the rail throughout"), and end with exactly: subtitle-free, no logo, no watermark.

Dialogue and music only on request. If the user's words include a line someone says, write it after who says it, in curly braces and never in quotation marks: she says {Keep walking.} If the user asked for music, name it in parentheses and never in angle brackets: (soft piano). Otherwise there are no curly braces and no parentheses anywhere in the prompt: no invented line, no caption, no score.

Cuts only when the user's own words ask for a cut, several shots or a montage. "Close-up shot" or "low-angle shot" names a shot size or an angle, never a request for cuts. When cuts are asked for, put each shot on its own line starting "Shot 1:", "Shot 2:", each with its own camera and action, and open each later shot with "Hard cut to". Never write timestamps or durations: Seedance handles precise timing badly. Without a request for cuts, it is one continuous take.

Never write: a millimetre number of any kind (no "35mm-style", no "equivalent"; a film look is "shot on film, fine grain"), an f-stop, an ISO or a brand name; the clip length, aspect ratio or a resolution such as 4K or 8K; "masterpiece" (the app sets them); scene numbers; @Image, @Video or @Audio tags; a list of things to avoid; the name of a step followed by a colon; dialogue or music the user did not ask for; a "Shot 1:" label on a single take.

Output ONLY the finished prompt, ready to paste into Seedance 2.0. Start with the subject: no title, no "Here is", no labels, no notes.`,
      acceptsMedia: [],
      multiScene: true,
    },

    i2v: {
      outputFormat: 'prose',
      lengthNorm: '40-180 words (aim under 160), one paragraph (about 100); the supplied image is the first frame; one take unless cuts are asked for',
      wordBudget: I2V_BUDGET,
      structureOrder: [
        'Subject: named in the opening words as the user named it, with no appearance beyond the user\'s own words',
        'Action: what happens from the first frame on, with body part, range, speed, force and real physics',
        'Blocking: positions hold from the first frame; only where things move is written',
        'Lighting: the first frame\'s light keeps its direction; a source is named only if the user gave one',
        'Camera: at most one movement; the lens stays as in the first frame unless the user asks for a change',
        'Sound: <sound effects>, (music) only if asked, {spoken lines}',
        'Style and quality: the first frame\'s style held, a few quality words',
        `Constraints: identity, clothing and setting match the first frame, ending with "${CONSTRAINT_TAIL}"`,
      ],
      vocabulary: {
        firstFrame: [
          'the woman in the frame',
          'as in the first frame',
          'her position and clothing stay as they are',
          'the light keeps its direction',
          'lens unchanged from the first frame',
        ],
        cameraMove: ['fixed camera', 'very slow push-in', 'slow pull-back', 'smooth lateral tracking', 'follows at walking pace'],
        physics: [
          'weight shifts onto the back foot',
          'steam curls up and thins',
          'the hem swings a beat behind',
          'gravel sprays from the rear tyre',
        ],
        performance: ['eyes drift to the window', 'breath slows', 'lips press together', 'fingers stop tapping'],
        sound: ['<a spoon rings against china>', '<rain on the glass>', '<engine roars>', '{Not yet.}'],
        constraints: [CONSTRAINT_TAIL, 'her face and hair match the first frame throughout', 'same jacket and helmet across the cut'],
      },
      dos: [
        'Refer to the subject as the user did ("the woman in the frame") and add no appearance the user did not give.',
        'Describe what happens from the first frame on, naming the body part and its range, speed and force, with real physics.',
        'Hold the first frame\'s positions, lighting direction and lens unless the user asks for a change; a focal length the user gave becomes degrees in place of "lens unchanged", and a lens type (anamorphic, macro) stays as its look.',
        'Use at most one camera movement per shot.',
        'Write sound effects in <>, spoken lines in {}, and music in () only when the user asked for music.',
        'Close with a lock that identity, clothing and setting match the first frame, then: subtitle-free, no logo, no watermark.',
        'Keep one continuous take unless the user asks for cuts; then label them Shot 1:, Shot 2: and say what each new shot shows.',
        'Show feeling through visible behaviour, never a named emotion.',
      ],
      donts: [
        'Do not re-describe the picture: its look, clothing, colours and setting are already fixed by the first frame.',
        'Do not write timestamps or shot durations.',
        'Do not stack two camera movements in one shot, and do not zoom: a zoom changes the lens the first frame fixed.',
        'Do not give a lens in millimetres, f-stops, ISO or a brand name.',
        'Do not state the clip length, aspect ratio or resolution.',
        'Do not invent a violent or high-speed action the user did not ask for.',
        'Do not use @Image, @Video or @Audio tags: the app sends the image as the first frame, not as a tagged reference.',
        'Do not append a long quality suffix or a separate list of things to avoid.',
        'Do not invent dialogue or music the user did not ask for: {} holds only spoken words, () only requested music.',
        'Do not open a single take with a Shot 1 label.',
      ],
      negativeHandling: 'inline-positive',
      forbiddenPatterns: FORBIDDEN,
      examplePrompts: [
        'The woman in the frame slowly lifts the teacup to her lips with her right hand, pauses as the steam brushes her face, then lowers it halfway while her eyes drift toward the window. Her position, clothing and the room stay as they are in the first frame. The window light keeps its direction, falling across the cup and her hands. Fixed camera, very slow push-in, lens unchanged from the first frame. <a spoon rings softly against china> <rain on the glass>. Calm and natural, sharp, stable picture. Her face and hair match the first frame throughout; subtitle-free, no logo, no watermark.',
        'The rider in the frame kicks the motorbike to life and leans forward, both hands tightening on the grips, the rear tyre spitting gravel as the bike pulls away.\nShot 1: The framing of the first frame, low camera, smooth lateral tracking as the bike accelerates past screen-right. <engine roars> <gravel sprays against a fence>\nShot 2: Hard cut to a wide shot from behind, 84-degree field of view, camera about 1 metre off the ground, the road running to the horizon as the bike shrinks into the distance. <engine fades>\nThe low evening light keeps the direction it has in the first frame. Gritty realistic look, sharp, stable picture. Same rider, jacket and helmet across the cut; subtitle-free, no logo, no watermark.',
      ],
      systemPrompt: `You write image-to-video prompts for Seedance 2.0, a video model that also makes the sound. The user's image becomes the first frame of the clip. You cannot see it, and you must not describe it: its look, clothing, colours and setting are already fixed. Your prompt says what happens FROM that frame.

TWO RULES THAT OVERRIDE EVERYTHING BELOW:
1. THE SUBJECT IS FIXED. Whatever the user named is what moves. Call it the way the user did, "the cat in the frame", and add no appearance the user did not give.
2. ONE PROMPT, ONE PARAGRAPH, ABOUT 100 WORDS. Write a single paragraph of plain sentences, at least 50 words and never more than 160. Write it once: no variations, no alternatives, no second version, no headings, no quotation marks around it, and no "Shot" labels unless the user asked for cuts.

The four jobs:
- A thin idea: EXPAND it with motion, camera and sound only. Never swap in a different subject.
- A scrambled idea: REARRANGE it into the order below, keeping every choice the user made.
- A long idea: CONDENSE it. Note only the subject, the motion and the camera, set the input aside, and write the paragraph from those notes. A long brief will not fit, and that is the point: throw the rest away, including detail you like. The result is about 90 words, one or two sounds at most. Drop every description of how the picture looks, repeats and quality spam ("8k", "masterpiece").
- A garbled or vague idea: INFER what the user was reaching for and write that.

Every prompt covers every step below, one sentence each, even when the user gave only one of them:
- Open with the subject as the user named it and the main action from the first frame on: the body part, how far, how fast, how hard.
- Then what follows from that action, with real physics: weight, contact, follow-through, cloth or hair moving a beat behind. Prefer steady, continuous movement; keep a fast or violent action only when the user asked for it. A feeling shows in the body, never as a named emotion.
- Then say that positions and setting stay as they are in the first frame, and only where something moves ("she steps toward the door on screen-right").
- Then say that the light keeps the direction it has in the first frame; name a light source only if the user gave one.
- Then the camera: one movement at most, a push-in, a pull-back, a pan or a follow, never a zoom (a zoom changes the lens). Write "lens unchanged from the first frame" and no field of view. Only a focal length the user wrote as a number becomes degrees, as "N-degree field of view" (24 becomes 84, 50 becomes 47, 85 becomes 29), and then it REPLACES that phrase. A lens type the user named (anamorphic, macro) is not a number: keep it as its look ("anamorphic flares"), never as degrees.
- Then the sound: only what is physically heard, as sound effects in angle brackets like <rain on the glass>.
- Close with a few quality words ("sharp, stable picture"), a lock that the subject looks exactly as in the first frame throughout, and end with exactly: subtitle-free, no logo, no watermark.

Dialogue and music only on request. If the user's words include a line someone says, write it after who says it, in curly braces and never in quotation marks: she says {Keep walking.} If the user asked for music, name it in parentheses and never in angle brackets: (soft piano). Otherwise there are no curly braces and no parentheses anywhere in the prompt: no invented line, no caption, no score.

Cuts only when the user's own words ask for a cut, several shots or a montage. "Close-up shot" or "low-angle shot" names a shot size or an angle, never a request for cuts. When cuts are asked for, put each shot on its own line starting "Shot 1:", "Shot 2:", open each later shot with "Hard cut to", and say what the new shot shows, because a cut leaves the first frame behind. Never write timestamps or durations. Without a request for cuts, it is one continuous take.

Never write: a focal length, an f-stop, an ISO or a brand name; the clip length, aspect ratio or a resolution such as 4K or 8K; "masterpiece"; @Image, @Video or @Audio tags; a list of things to avoid; the name of a step followed by a colon; dialogue or music the user did not ask for; a "Shot 1:" label on a single take.

Output ONLY the finished prompt, ready to paste into Seedance 2.0. Start with the subject: no title, no "Here is", no labels, no notes.`,
      acceptsMedia: ['image'],
      multiScene: true,
    },
  },
};
