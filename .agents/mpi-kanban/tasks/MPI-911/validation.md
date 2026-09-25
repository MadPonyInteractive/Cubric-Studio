# MPI-911 Validation

## Heal header

- **Recipe:** `seedance-2.0` (`js/data/recipes/seedance-2.0.recipe.js`), modes `t2v`, `i2v`.
- **Modes a production shot:** none. This is a vendor-skill merge, not field evidence: every
  row's basis is `vendor` or `inferred`, and both modes hand back with no field evidence.
- **Findings path:** `.agents/mpi-kanban/private/seedance-skills/` (gitignored, never quoted
  here: the origin repo is public). Evidence cells cite file, heading and line, paraphrased.
  `D` = `CINEDANCE HIGGSFIELD SKILL.md` (Seedance 2.0 director), `A` = `ACTING SKILL.md`
  (Seedance 2.0 performance), `B25` = `prompt-builder-2-5.skill` (a Seedance **2.5** skill:
  corroboration only, never 2.0 authority).
- **Instruction (card description, verbatim):** "Heal via /create-enhancer-recipe: rewrite recipe
  modes and docs/agent/models/seedance-2.0 in our own words (third-party text, never shipped
  verbatim), record adopted and rejected conventions with reasons, and compare against the top
  GitHub Seedance skills. Every agent doc stays <= 200 lines, so this model becomes a folder of
  skills behind one router (MPI-903 adds the folder support)."
- **Surface:** the director writes for Higgsfield's UI, where references are `@tag` handles and
  duration, ratio and resolution are set outside the prompt. Vision sends the prompt plus, for
  `i2v`, one image as `first_frame_image`, and sets duration, ratio and tier itself. The Prompt
  Box enhancer never sees the image. Rules scoped to multi-reference input are recorded for
  MPI-910, not adopted.

## 3a. Rule inventory

Walked heading by heading to the end of each file. One line per rule, paraphrased.

### D, Seedance 2.0 director

1. Header, L11: the output is the finished prompt only, unless analysis is asked for.
2. Header, L13-15: plain, direct English; concrete, observable, measurable instructions beat poetic language.
3. Core objective, L15-35: aims at a correct first frame, placement, gaze, body orientation, landmark distance, camera side, optics, physics, lighting, dialogue timing; no context leakage, unused characters, stale tags or scene numbers.
4. D1 Deconstruct, L43-66: extract only the current shot's characters, references, props, action, dialogue, format, camera, first frame, layout, landmarks, path, light direction, emotion and audio.
5. D1, L68-81: remove unused characters and tags, scene numbers, script headers, earlier-scene wording and back-references ("as above", "continues").
6. D1, L83: nothing enters the prompt that this shot does not need on screen.
7. D2 Diagnose, L87-110: check the likely failures (empty or late first frame, useless establishing opening, landmark distance, gaze reversal, left/right flip, wrong camera side, lens drifting to a middle value, flat front light, prose overriding the reference, extra people, prop in the wrong hand, floaty motion, dialogue timing, location used as framing, cuts resetting continuity) and add a short lock for each real risk.
8. D3 Develop, L114-131: build order: context, settings, references, location map, first frame, blocking, anchors, format, optics, camera, timing, physics, lighting, audio, positive locks, local locks.
9. D3, L133-139: placement before camera style; optics before aesthetics; lighting is a priority lock, not decoration.
10. D4 Deliver, L143-155: no QA, reasoning, checklist or writing notes in the output.
11. Final prompt architecture, L163-178: the prompt is written as labelled sections, SCENE CONTEXT through POSITIVE CONSTRAINTS.
12. Final prompt architecture, L161 + L180-183: sections are optional; settings only when the UI does not set them; a negative block only on request or for a known failure; local inline locks preferred over a final negative block.
13. Scene context, L187-195: one or two short sentences, this shot only; no scene numbers, prior summaries, inactive characters or headers.
14. Output settings, L207-221: leave out duration, ratio, generation mode, fps, shutter, model name, resolution and seed when the UI sets them.
15. Output settings, L225-231: settings worth stating in the prompt are single take vs cuts, real time vs slow motion, audio, subtitle and dialogue rules.
16. Active references, L243-255: list only the tags used in this shot, exactly as given; never invent or carry a stale one.
17. Character description rule, L259-284: per referenced character, minimal anchors only (age, role or build, current state, unique visible marks, action-critical body part or prop, voice only with dialogue), closed by a statement that it matches the reference.
18. Character description rule, L271-278: leave out facial anatomy, costume detail the reference already shows, random adjectives, irrelevant injuries, unused props, relationship labels.
19. Character description rule, L298-300: the reference is the truth for face, body, costume and identity; prose must not override it.
20. Location map, L304-317: with a location reference, map camera position and facing, depth layers, landmarks, positions, movement path and light direction.
21. Location map, L319-327: a location reference supplies geography, materials, atmosphere and landmarks, never the camera angle or framing unless asked.
22. First-frame occupancy lock, L331-341: when subjects must be visible from the start, say the opening frame already holds them in position; no empty establishing frame or delayed reveal.
23. First-frame occupancy lock, L343-353: an empty opening only on request; a flash cut still carries subject or location; no filler or random landscape inserts.
24. Spatial blocking lock, L357-367: for each important subject give screen position, world position, distance to a landmark or person, body facing, gaze, movement direction and depth layer.
25. Spatial blocking lock, L383-401: replace vague proximity words (near, around, beside, nearby) with a measured distance or a contact.
26. Gaze line and body orientation lock, L405-417: body facing and eye direction are separate instructions; write both.
27. Gaze line and body orientation lock, L419-425: in dialogue only the speaker's lips move for the scripted line; listeners stay silent; no offscreen voices.
28. Landmark proximity lock, L429-455: tie a character to a landmark physically: metres, contact, a hand on the object.
29. Format mode decision, L459-471: choose single continuous take or controlled multi-shot; the default is one take.
30. Format mode decision, L471-483: cut only when asked, when the action cannot be staged from one position, when a detail needs an insert, or for two simultaneous reactions, geography plus reaction plus detail, or fragmented editing styles.
31. Format mode decision, L485-497: a multi-shot prompt defines every shot's duration, camera, opening subjects, blocking, action, and the cut type between them.
32. Format mode decision, L499-505: the model must never invent cuts; no random montage; no cut to an inactive element; continuity holds across every cut.
33. Multi-shot continuity lock, L509-523: every cut keeps the character list, geography, screen direction, gaze targets, left/right, light direction, wardrobe, wounds, props, hand states, dirt and particle continuity, object states, emotional progression.
34. Multi-shot continuity lock, L525-531: no action reset, no teleporting, no distance change without movement, no new props or people after a cut.
35. Cut types, L535-545: name the cut explicitly: hard, smash, match, insert, reverse or whip.
36. Cut types, L546-561: no fades, crossfades, dissolves or transition effects unless asked.
37. Optics and lens control module, L565-597: control the lens by diagonal field of view in degrees, camera distance and visible outcome; never millimetres, f-stops, ISO or lens brands as the control.
38. Optics and lens control module, L579-587: the working bank is 47, 84, 107, 29, 18 and 8 degrees.
39. Lens decision tree, L600-625: pick the lens by content: face portrait (84 intimate wide, 29, 18, or 8 for hidden observation), environmental action (47, 84, 107, 135 only for a fully environmental beat), detail (29 or 18), distant observation (8 with foreground occlusion).
40. Content-FOV alignment rule, L629-635: wide suits environmental, spatial, body-near-camera content; telephoto suits portrait, observation, isolation; detail is its own insert.
41. Content-FOV alignment rule, L637-641: never mix content classes in one lens beat; cut and give each shot its own lens.
42. Angle of view language bank, L643-681: each angle pairs with a camera distance and a visible outcome (47: a few metres, natural proportions; 84: about a metre, expanded perspective, straight lines; 107: under a metre, looming foreground, no fisheye; 29: several metres, compressing background, soft bokeh; 18: further, strong compression, thin focus; 8: tens of metres, flattened background, foreground occlusion required).
43. Telephoto visual outcome stack, L685-696: a telephoto shot carries at least four observable outcomes (background wash, razor focus, compression, reach not proximity, haze, foreground occlusion).
44. Wide-angle visual outcome stack, L700-710: a wide shot carries at least three (looming foreground, visible surroundings, deep focus, straight lines, camera close, no compression).
45. Multi-shot lens consistency, L714-722: a same-lens sequence states the lens once as fixed and re-checks it per shot.
46. Multi-shot lens consistency, L724-747: a lens changes only with the content, only at a hard cut; no smooth FOV change, no drift inside a shot; cuts preserve the continuity list.
47. Anti-drift locks, L749-769: when relevant, one sentence per lens class forbidding the switch to another class.
48. Optics anti-patterns, L773-785: never "extreme/ultra/super wide", a shot size used as the lens, zooming out on a wide lens, "tight wide", metadata as control, two camera moves in one shot, mixed content classes, a lens controlled only by negatives.
49. Camera and composition, L789-804: camera as operator behaviour: lens, height, distance, angle, side, subject size, screen placement, movement, focus, depth of field, handheld quality.
50. Camera and composition, L806-818: prefer fixed or from-to moves, lens height, operator side, thirds placement, negative space; profile or three-quarter by default, frontal only when needed.
51. Camera and composition, L820-828: with composition freedom, still hold placement, gaze, landmark, light, references, timing, lens.
52. Handheld camera rule, L832-848: handheld as physical operator behaviour (breath, settling, weight shift, correction); no digital jitter, random shake, or gimbal, drone or dolly feel unless asked.
53. Physics lock, L852-873: physical properties the prompt holds to: gravity, mass, momentum, friction, contact, shifting weight, collision, follow-through, cloth and hair lag, fluids, particles, vehicle mass.
54. Physics lock, L875-889: motion has cause and effect; nothing floats, weighs nothing, slides frictionless, teleports, or moves like rubber or a game engine.
55. Physics lock, L891-897: walking: heel strike, weight transfer, hip shift, toe push-off.
56. Physics lock, L899-906: running: ground contact, knee lift, opposing arms, lean, varied stride.
57. Physics lock, L908-914: a held weapon or object shows weight, inertia, acceleration; no pose-to-pose jumps.
58. Physics lock, L916-921: liquids follow gravity, arc, leave residue, have viscosity.
59. Physics lock, L923-928: particles follow the wind, fill every depth layer when atmosphere matters, accumulate, shimmer with heat.
60. Lighting priority lock, L932: lighting is a constraint, not decoration.
61. Lighting priority lock, L934-945: backlight: subject between camera and brighter background, camera on the shadow side, faces dark, detail only from rims and speculars, no front key or fill.
62. Lighting priority lock, L947-953: if a result went flat, expose for the backlight and let the face fall into shadow.
63. Lighting direction, L957-966: always name the primary source, its direction, the camera side relative to it, the subject's shadow or rim side, background brightness, exposure priority, allowed highlights and the failure to avoid.
64. Action timing, L976-994: a timed shot is written in time blocks (0:00 to 0:03 and so on), each carrying position, action, camera, prop state, physics and audio.
65. Action timing, L996-1000: no contradictory actions in one block; a single take's action must fit its duration; every cut has a reason.
66. Dialogue rules, L1004-1020: only the quoted line is spoken; no ad-libs, subtitles, captions or narration; names only if in the line; no offscreen voices; lips still when silent.
67. Dialogue rules, L1022-1025: for clean dialogue the ambience ducks and the voice is close.
68. Dialogue rules, L1027-1033: a second of silence around a line when needed; an immediate line starts within a third of a second.
69. Prior audio context, L1037-1043: an earlier line kept for emotional continuity is marked as audio context, never shown.
70. Context isolation rules, L1047-1065: the prompt is a sealed document for this shot: no scene or episode labels, headers, summaries, unused tags, back-references, or "the other character" without a name.
71. Reference control, L1069-1106: references rank by kind: identity (face, body, age, costume), location (architecture, geography, landmarks, light), prop (shape, scale, material, contact, state), vehicle (model, markings, damage).
72. Reference control, L1108-1110: a location reference never overrides the camera angle; a style reference never overrides identity, blocking, action, optics or lighting.
73. Prompt density control, L1114-1135: dense where control matters (anchors, blocking, first frame, gaze, landmark, hands, props, timing, optics, lighting, physics, dialogue); light on beauty, costume, extras, inactive props, what the reference shows.
74. Prompt density control, L1137-1141: no decorative adjectives; a stronger signal, not a longer prompt.
75. Style language, L1145-1162: style comes after the locks and serves them; a film stock or look as a compact anchor.
76. Style language, L1155-1172: no poetic mood, vague cinematic adjectives, style that contradicts camera or light, or long lists of cinematographers.
77. Negative constraints, L1176-1193: no standalone negative block by default; a local "no X" beside the positive rule it protects.
78. Negative constraints, L1195-1211: worthwhile negatives are specific failures (duplicates, extras, unused tags, empty first frame, wrong gaze, landmark distance, flat front light, CG gloss, game-engine look, floating motion, subtitles, unrequested music).
79. Negative constraints, L1213-1217: write the wanted state first, then the failure; omit negatives when none is needed.
80. Seedance-safe language, L1221-1256: simple visual verbs and measurable terms (metres, screen-left, depth layers, heights, degrees, timestamps, counts).
81. Seedance-safe language, L1258-1260: no nested clauses; psychology only as visible behaviour.
82. Quality suffix, L1264-1270: a short quality suffix only when useful and not conflicting; never a substitute for camera, light or physics control.
83. Silent self-QA before output, L1274-1297: check tags, first frame, positions, gaze, orientation, landmarks, camera side, lens by content, lens outcome and drift, light not flat, props in hands, physical possibility, timing, dialogue, leakage, English; fix before output.
84. Final output rule, L1301-1330: output only the prompt with the sections it needs; settings omitted when the UI controls them; no negative block by default; no analysis, QA, method or change notes.

### A, Seedance 2.0 performance

85. Header, L11-14: acting is behaviour under pressure (a want, an obstacle, an action), never a display of emotion.
86. Section 1, L27-34: pursue an objective rather than show a feeling; listen and react; the body has its own life; rhythm changes with tactics; states run continuously; the face thinks.
87. Section 2.1, L41-46: the objective is a verb aimed at a partner, now; never a state.
88. Section 2.2, L48-53: an obstacle and real stakes.
89. Section 2.3, L55-58: tactics are action verbs and change when they fail.
90. Section 2.4, L60-66: two to four beat changes, each visible (a pause, posture, tempo, gaze).
91. Section 2.5, L68-74: subtext leaks through behaviour; its markers are listed.
92. Section 3, L78-93: reaction starts before the partner finishes; a pause before a hard answer; a moment to absorb news; energy answers energy.
93. Section 4.1, L97-109: set centre of gravity, tempo, openness and breath; sound must match the body's state.
94. Section 4.2, L111-118: give the character a physical task; stopping it is punctuation.
95. Section 4.3, L120-126: distance zones carry the relationship; a distance change is a beat change.
96. Section 4.4, L128-135: status is behaviour; status breaks are the interesting moments.
97. Section 5, L139-148: speech rhythm, clean key words in overlaps, quiet is more frightening than loud, pauses must contain something, real speech is untidy.
98. Section 6, L156-176: a recurring character gets one master acting profile, one paragraph of fixed block order (body, drive, voice, tics with triggers, gait, the conditional transformation, one softening target).
99. Section 6, L180-213: profile rules: observable only; every tic has a trigger; a named gait; a mask and its crack; one softening target; no wardrobe, camera or colour; physique carries biography.
100. Section 7, L217-234: eye life in every scene: moving gaze, blink rate tied to state, live catchlights, chosen stillness, eyes lead the head, eye behaviour shifts with the beat.
101. Section 8, L238-257: per scene the profile is rewritten, not pasted: present characters only; constant core kept; behaviour re-expressed; transformed, not deleted; one flowing paragraph without bullets or headers.
102. Section 8, L258-259: lead with the character's reference tag when the pipeline uses tags.
103. Section 9, L263-279: the voice is locked: one short voice line reused unchanged whenever the character speaks, omitted when silent, consistent with the acting paragraph.
104. Section 10, L283-287: describe states, not transitions: the character already mid-action, states chained beat by beat.
105. Section 11, L291-313: ensemble: staggered reactions, the reaction frame over the action, freeze at the threat, motivated movement, still and quiet reads strong, threat without wind-up, wear accumulates.
106. Section 12, L321-337: a failure table with prompt-level fixes, including less movement the tighter the shot.
107. Section 13, L341-349: a performance scale; hero shots aim high; the top level plays two truths at once.
108. Section 14, L353-364: a pre-send checklist restating sections 2-11.
109. Part IV, L368-429: a worked example (invented character): a pattern, not a rule.
110. Final axioms, L435-444: restate the system; when in doubt, cut.

### O, the official ByteDance guide (found in this pass; outranks D where they conflict)

BytePlus ModelArk, "Dreamina Seedance 2.0 series prompt guide",
`docs.byteplus.com/en/docs/ModelArk/2222480`, last updated 2026-09-22, read 2026-09-24 in the
browser pane (client-rendered: WebFetch returns it empty).

111. Advanced formula: precise subject, action details, scene, lighting and colour tone, camera movement, style, image quality, constraints, in that order: who does what, then where and the atmosphere, then how to shoot, then style, quality and constraints.
112. Define the subject: two or three stable static features that identify it uniquely; the same label every mention; concise, no contradictions.
113. Define the subject: express spatial relationships through a reference image first, text second.
114. Shot sequencing: a complex video is a shot-ordered storyboard labelled Shot 1, Shot 2, Shot 3, in the order events happen.
115. Shot sequencing: no strict per-shot durations; precise timing such as 0-3 seconds is unstable and can break the result.
116. Shot sequencing: each shot carries the camera move or transition, the subject's action and expression, position or space, and audio.
117. Action: name the body part and quantify range, speed and force.
118. Action: prefer slow, gentle, continuous small movements; high-burst moves (sprints, big jumps, violent rolls) are riskier.
119. Action: state how one action carries into the next (inertia, continuity).
120. Action: an emotion becomes concrete physical detail, never an abstract word.
121. Camera: standard film terms are understood; one camera movement type per shot.
122. Image quality: a few short quality words.
123. Style: overall art style and tone words.
124. Constraint words matter; the standard ones are subtitle-free, no logo, no watermark.
125. Special characters: music in `()`, sound effects in `<>`, dialogue in `{}`, subtitles in `【】`; one dialogue language; an uncommon language is named.
126. FAQ, face reference: a headshot plus a full-body photo; multi-view sheets make identity drift and duplicates worse.
127. FAQ, subtitles: an explicit constraint lowers the odds; landscape lowers them further.
128. FAQ, duplicates: bind each character to its reference, add a global no-duplicate constraint, never paste a whole script.
129. FAQ, style drift: name the style explicitly when it differs from the reference.
130. FAQ: more than four reference people is unstable.
131. FAQ, voice: describe the voice's characteristics in words.
132. Text generation: text content, timing, position, entrance and look; common characters.
133. Other tips: one continuous take for single-scene dialogue; separate clips for turning points and fast action.
134. Asset strategy: four or five assets; never the full limit.

### Community (tier 3) and the 2.5 builder

135. `dexhunter/seedance2-skill` (3,926 stars, Seedance 2.0, Jimeng): formula of subject, scene, action, camera, timing, transitions, audio, style; timed segments recommended for clips of ten seconds or more.
136. `songguoxs/seedance-prompt-skill` (2,842 stars, Seedance 2.0, Jimeng): output mandated in Chinese; timed storyboards for 13-15 s clips; a closing prohibition block.
137. `krea-ai/skills` `seedance-2.md` (family document, 2.5 first): `Shot N` preferred over timestamps; two or three stable traits per subject; a constraints tail; one camera move per shot.
138. B25 (Seedance 2.5): labelled sections, a degrees table, timed hard cuts. Corroborates D's degrees; never 2.0 authority.

Inventory count: 138 (84 D, 26 A, 24 O, 3 community, 1 B25).

## 3b. Classification against the recipe at HEAD

Every "Recipe today" cell was searched verbatim in `git show HEAD:js/data/recipes/seedance-2.0.recipe.js`
(scratch script, 32 quotes, 0 missing). `-` = the recipe is silent. Basis: `vendor` for D, A and O
rows; `inferred` for surface rows (what Vision sends).

| # | Inventory # | Recipe today (verbatim) | Evidence | Mode | Basis | Verdict |
|---|---|---|---|---|---|---|
| R1 | 8, 9, 11, 84, 111 | `outputFormat: 'structured-tags'` / `outputFormat: 'timeline'` | O formula (111) is prose in a fixed order; D's labelled sections (11) are a platform convention O does not document | both | vendor | contradicts: `prose`, O's order; D labels not adopted |
| R2 | 9, 60, 111 | `'Lighting & Style',` | O gives lighting and style separate slots; D makes lighting a lock | t2v | vendor | contradicts |
| R3 | 29-32, 114, 116, 133 | `Limit to 3–5 segments total.` / `Keep total segments to 3–5 to avoid overloading the model with conflicting direction.` | D defaults to one take; O storyboards only a complex video | i2v | vendor | contradicts: one take by default |
| R4 | 64, 65, 115 | `Implement timeline timestamps ([0s-4s]) for sequences longer than ~5 seconds.` / `[Xs-Ys]: [Shot type], [single camera movement], [subject action], [audio cue]` | O: precise timing is unstable; D's `0:00 to 0:03` blocks rejected on the same line | both | vendor | contradicts: `Shot 1:` labels, no durations |
| R5 | 31, 35, 36, 114 | `Do not mix timeline timestamp format ([0s-4s]) and shot-label format (Shot 1:) in the same prompt.` | O's `Shot N` replaces the timestamps, so the ban has nothing left to ban; D names the cut type | i2v | vendor | contradicts: replaced by "name the transition, no timestamps" |
| R6 | 37-44, 48 | `'35mm',` | D: diagonal field of view in degrees, never millimetres | both | vendor | contradicts |
| R7 | 82, 122 | `Always append the exact quality suffix string verbatim at the end of every prompt.` / `Do not omit the quality suffix — its absence degrades consistency and stability.` | D: short and optional; O: a few quality words | both | vendor | contradicts |
| R8 | 126 | `For character consistency, use a 3-still reference pack (front, three-quarter, profile) with neutral expressions and consistent lighting.` | O: multi-view sheets worsen drift and duplicates | model | vendor | contradicts: removed |
| R9 | 16, 102 | `Every uploaded asset MUST receive an explicit @tag job. Assets without an assigned role are ignored by the model.` | Vision sends one `first_frame_image` and no tags | i2v | inferred | contradicts: removed; recorded for MPI-910 |
| R10 | 48, 121 | `Use only one camera movement per segment — never stack multiple camera moves.` / `Do not stack multiple camera movements in one shot segment.` | O: one movement type per shot; D bans compound moves | both | vendor | confirms |
| R11 | 48 | `Do not use contradictory framing terms ("close-up wide shot", "static tracking shot").` | D bans "tight wide" and shot size as a lens instruction | t2v | vendor | confirms |
| R12 | 17-19, 112 | `Do not over-describe the face in text when a character @reference image is uploaded (causes the model to match the text category, not the face).` | D: the reference is the truth; O: two or three features | both | vendor | confirms: reworded for the first frame (no `@reference` in the app) |
| R13 | 12, 77-79, 124 | `negativeHandling: 'inline-positive'` | D: local locks, no negative block; O: constraint words inside the prompt | both | vendor | confirms |
| R14 | 1, 10, 84 | `Do not output introductory text, explanations, or any framing around the prompt.` | D: output the prompt only | both | vendor | confirms |
| R15 | 65 | `Do not assign more than one primary action per short segment to avoid "slideshowy" output.` | D: no contradictory actions in one block | both | vendor | confirms |
| R16 | 2, 76 | `Do not use vague direction like "make it look cool" — the model will guess and produce generic output.` | D: concrete over poetic | t2v | vendor | confirms |
| R17 | 53-59, 117, 119 | `Use physics-aware action verbs (tires smoke, glass shatters, fabric billows) — never vague motion words like "moves" or "becomes".` | D physics lock; O body part plus range, speed, force, and the carry between actions | both | vendor | confirms; extended with O's body-part rule |
| R18 | 118 | `'tires smoke as the car drifts 90 degrees',` | O: bursts are riskier; prefer continuous movement | both | vendor | contradicts as a default: the enhancer keeps a burst the user asked for, never invents one |
| R19 | 73, 74 | `If the input is too brief, invent 1–3 cinematic details per section to fill the structure.` | D: detail where control matters, no decorative adjectives | both | vendor | contradicts: invent control detail (position, light direction, lens), not decoration |
| R20 | 22-28, 113 | - | D first-frame, blocking, gaze, landmark locks | t2v; i2v via the frame | vendor | new: adopted |
| R21 | 37-44 | - | D field of view bank with distance and outcome | both | vendor | new: adopted (i2v keeps the frame's lens unless asked) |
| R22 | 60-63 | - | D lighting lock | both | vendor | new: adopted (i2v holds the frame's light) |
| R23 | 66-69, 125 | - | O notation `{}` `<>` `()`; D only the scripted line | both | vendor | new: adopted; D's one-second and third-of-a-second timings rejected on O 115 |
| R24 | 124, 127 | `Generate the video without subtitles.` | O constraint words | both | vendor | confirms the intent; moves into the constraints tail with no logo and no watermark |
| R25 | 85-110, 120 | - | A performance system; O emotion as physical detail | both | vendor | new: the enhancer writes visible behaviour and states, not transitions; the full system goes to the guide |
| R26 | 3-6, 13, 70 | - | D sealed current-shot prompt | both | vendor | new: `donts` |
| R27 | 14, 15 | - | D: settings the UI sets stay out of the prompt | both | vendor | new: no duration, ratio or resolution words (the old suffix's resolution claim was one) |
| R28 | 20, 21, 71, 72 | - | D location and reference control | none today | vendor | deferred: no reference input is sent; MPI-910 |
| R29 | 33, 34, 45-47 | - | D continuity and lens across cuts | both | vendor | new: one lens per shot, change only at a cut; detail in the guide |
| R30 | 49-52 | `'handheld documentary style',` | D: handheld written as operator behaviour | both | vendor | contradicts in part: handheld described physically |
| R31 | 80, 81 | - | D measurable, simple language | both | vendor | new |
| R32 | 7, 83 | - | D diagnose-and-lock, silent QA | both | vendor | new: guide only (the enhancer outputs the prompt alone) |
| R33 | 128 | - | O no-duplicate constraint, no pasted script | both | vendor | new: a no-duplicate lock when several people share the frame |
| R34 | 130, 134 | - | O asset counts | none today | vendor | deferred: MPI-910 |
| R35 | 132 | - | O on-screen text | both | vendor | new: guide only |
| R36 | 133 | - | O one take for dialogue, clips for fast action | both | vendor | new: guide `shots-and-cuts` |
| R37 | 135-137 | - | community skills | both | community | recorded: timestamps rejected (O 115); Chinese-only output rejected (users write English, and O asks for one dialogue language); krea corroborates O |
| R38 | 138 | - | B25 | - | 2.5 | corroboration only |
| R39 | 75, 123, 129 | `Do not omit the Global Style block — without it, visual consistency across shots degrades.` | O: style is one slot near the end; D: style after the locks | i2v | vendor | contradicts: style in its formula slot, no block label |
| R40 | 29, 106 | `Scale shot size to escalate emotion: wide → medium → close-up.` | D: one take by default; A: the tighter the shot, the less movement | i2v | vendor | contradicts as a default (it forces cuts): only when cuts are asked for |
| R41 | 16 | `acceptsMedia: ['image', 'audio', 'video']` | Vision sends one image | i2v | inferred | contradicts: `['image']` |
| R42 | 16 | `Assign every uploaded @asset a specific role in the prompt (@Image1 as the first frame, @Video1 for camera motion reference).` | t2v sends no media | t2v | inferred | contradicts: removed |
| R43 | 16 | `Add an @tag assignment if the user has uploaded reference media.` | t2v sends no media | t2v | inferred | contradicts: removed |
| R44 | 116, 131 | `Include specific audio adjectives to trigger the native audio engine (reverb, metallic clink, crowd murmur).` | O: audio per shot; voice described in words | both | vendor | confirms; sound effects now in `<>` |

Coverage: every inventory number 1-138 appears in at least one row.

## 4. Harvest (before editing)

- `docs/recipes/research/seedance-2.0/sources.md`: rows 11-18 (adopted and rejected, with
  reasons) and "Reference notes for MPI-910". `research.md`: "MPI-911 answers".
- Proposed for `.claude/rules/engine-recipes.md`, **needs Fabio's yes, not edited**: (a) a
  skill's frontmatter names its model version, read it before its body (the 2.5 builder);
  (b) a vendor guide that renders client-side reads as EMPTY to WebFetch, so "no official docs"
  needs a browser read behind it; (c) the Stage 1 engine is the registry's enhancer of record
  (`gemma-4-abliterated-12b`), not the skill doc's `dolphin3-abliterated` example.

## 5. Edits, row by row

Every `contradicts` and `new` row became an edit, or carries its reason here.

| Row | Edit (both modes unless named) |
|---|---|
| R1 | `outputFormat: 'prose'`; the vendor order; no labels (+ forbidden section-label pattern, added after the first sweep copied them) |
| R2 | lighting is its own step, style its own |
| R3, R40 | one continuous take by default; cuts only on request; a shot size is not a request |
| R4, R5 | `Shot 1:` / `Shot 2:`, "Hard cut to", no durations (+ two timestamp patterns, + a lone `Shot 1:` pattern) |
| R6, R21 | lens as "N-degree field of view" with distance, chosen by content, focal lengths converted (+ mm pattern) |
| R7, R24 | a few quality words and the tail `subtitle-free, no logo, no watermark` (+ old-suffix pattern) |
| R8 | the three-still pack rule removed |
| R9, R41, R42, R43 | every `@tag` rule removed; i2v `acceptsMedia: ['image']` (+ `@tag` pattern) |
| R12 | reworded: t2v two or three features; i2v adds no appearance at all |
| R17, R18 | body part with range, speed, force; physics vocabulary rewritten; bursts only when asked |
| R19 | expand with control detail, not decoration; condense by notes-then-rewrite |
| R20, R22 | t2v first-frame blocking and lighting steps; i2v holds the frame's positions, light and lens |
| R23 | `<>` effects, `{}` spoken words only when given, `()` music only when asked (the judge passed invented `{Meow.}` and unasked strings; caught by reading outputs, fixed by wording + `donts`) |
| R25 | feeling as visible behaviour; the full acting system lives in the `performance` sub-skill |
| R26, R27 | no scene numbers, no duration, ratio or resolution (+ resolution pattern) |
| R29 | one lens, never a second (two appeared in one output) |
| R30 | handheld described as operator behaviour |
| R31 | measurable placement words |
| R33 | no-duplicate lock in vocabulary and the `blocking` sub-skill |
| R39 | no Global Style block (+ pattern) |

Deferred: R28, R34 (reference and asset rules): no reference input is sent until MPI-910,
recorded in `sources.md`. Guide only, not the enhancer: R32 (silent QA; the enhancer outputs
the prompt alone), R35 (on-screen text), R36 (take vs stitching strategy). Confirms kept: R10,
R11, R13, R14, R15, R16, R44.

## 6. Stage 1

- **Harness:** `node scripts/recipe-test.mjs seedance-2.0 --mode <t2v|i2v> --engine gemma-4-abliterated-12b --judge gemma-3-12b --runs 3`,
  each run wrapped in `gpu_lease.py run`, never through `tee`. Five tiers (bare, medium,
  directed, overlong, general) x 3 runs = 15 per sweep. Ollama started as a bare `ollama serve`
  with `OLLAMA_MODELS=H:\OllamaModels` in the child env only (the path Ollama's own
  `server.log` records), as `services/ollamaLifecycle.js` does.
- **Engine:** the registry's enhancer of record, `gemma-4-abliterated-12b` (Plan Drift). Five
  sweeps on `dolphin3-abliterated` (8B) came first and are kept as wording evidence.

### Iterations and why

| # | Engine | Mode | Result | What it showed | Change |
|---|---|---|---|---|---|
| 1 | dolphin 8B | t2v | 5/15 | part names copied as `Subject:` labels; 226-406 words; invented `50mm`/`35mm`; a "Here's your prompt" preamble | forbidden section-label pattern; no "mm" token left in the prompt |
| 2 | dolphin 8B | t2v | fail, stopped | "write EIGHT sentences" read as eight VARIATIONS (564 words); medium collapsed to 15-22 words | one paragraph, written once; steps as "Open with / Then"; every step required |
| 3 | dolphin 8B | t2v | 9/15 | bare + medium hold; "close-up shot" read as a request for cuts; condense 255-280; "8K" leaked | a shot size is not a cut; no quotes; notes-then-rewrite condense; 4K/8K named |
| 4 | dolphin 8B | t2v tiers | fail | form-filling (`Place and time: undefined`); condense still long | climbed: playbook 05's measured 8B-to-12B word-cap threshold |
| 5 | gemma 12B | t2v | 15/15 | reading the outputs, not the count: invented `{Meow.}` / `{Steady now.}`, unasked music, a lone `Shot 1:`, two lenses in one prompt | spoken words only when given, music only when asked, ONE lens; lone-`Shot 1:` pattern; `donts` lines |
| 6 | gemma 12B | i2v | 14/15 | condense 162; same invented dialogue | (covered by 5's wording, shared) |
| 7 | gemma 12B | t2v x2 | 13/15, 15/15 | "35mm-equivalent 63-degree": the conversion shown | degrees alone, never "equivalent" |
| 8 | gemma 12B | i2v x2 | 14/15, 13/15 | "zooms in while the lens remains unchanged"; "80-degree ... lens remains unchanged"; condense 166-171 | no zoom in i2v (it changes the fixed lens); a named lens replaces "lens unchanged", never beside it; `donts` line |
| 9 | gemma 12B | t2v x2 | 14/15, 15/15 | condense 224 against 220 | ceiling to 240: admits the vendor's own longest example (234); prompt still aims under 220 |
| 10 | gemma 12B | i2v x2 | 14/15, 15/15 | condense 161 against 160 | ceiling to 180, settled by measurement (vendor gives none); prompt still aims under 160 |
| 11 | gemma 12B | t2v x2 | 15/15, 15/15 | green, but reading the outputs: invented `{I'm home.}`, `{so peaceful.}` (a caption in braces) and unasked `(gentle acoustic guitar)` in about one output in five; the step's own `{Keep walking.}` example primed it | the sound step shows only `<>` effects; dialogue and music move to a separate on-request rule ("otherwise no braces and no parentheses anywhere"); the in-flight i2v runs were stopped |
| 12 | gemma 12B | probe | 4/4 after one fix | no Stage 1 tier ASKS for dialogue, music or cuts, so a one-off probe (scratch `probe.mjs`) ran four requests that do: t2v dialogue and cuts right first time; asked-for music came back in `<>`, i2v dialogue in quotation marks | "in curly braces and never in quotation marks", "in parentheses and never in angle brackets"; re-probe 4/4: `{You promised me}` `{I know.}`, `(Soft piano)`, two shots with a hard cut, `{Not tonight}` |
| 13 | gemma 12B | t2v x2 | 15/15, 14/15 | a third focal-length form, "a wide 35mm-style lens", invented from "shot on film" in the condense input | t2v: no millimetre number of any kind; a film look is "shot on film, fine grain" |
| 14 | gemma 12B | i2v x2 | 15/15, 15/15 | green, but reading the outputs: 4 of 30 wrote a field of view beside "lens unchanged", one a nonsense 135 degrees; all from inputs naming a lens TYPE ("anamorphic") | i2v: only a focal-length NUMBER becomes degrees, replacing the phrase; a lens type stays as its look; `dos` line to match |

Every edit touched one mode's block only, and the other block was verified byte-identical
before its runs were counted.

### Final text: twice green

| Mode | Sweep | Result | Words (15 runs) | Read by eye |
|---|---|---|---|---|
| t2v | I | 15/15, exit 0 | 102-212 | no `{}`, no `()`, no digit-mm, no lone `Shot 1:`, no second lens |
| t2v | J | 15/15, exit 0 | 118-195 | same |
| i2v | I | 15/15, exit 0 | 90-164 | no `{}`, no `()`, no zoom, no field of view beside "lens unchanged" |
| i2v | J | 15/15, exit 0 | 94-141 | same |

Proof the swept text is the shipped text: the recipe was snapshotted before each pair; `cmp`
after i2v I/J reported it unchanged, and the t2v I/J snapshot differs from the final file
only at lines 231 and 273, both inside the i2v block (which begins at line 195). The probe
(iteration 12) passed 4/4 on the on-request path. Logs: scratch `final-*.log`.

## 7. Hand-back

- **Contradictions fixed:** every `contradicts` row (R1-R9, R18, R19, R30, R39-R43) is an
  edit; the `new` rows are edits or recorded as guide-only or deferred (section 5).
- **No field evidence in either mode.** Both modes' edits rest on the vendor (ByteDance's guide)
  and a serving platform's production skills, plus inference about what the app sends. Read the
  outputs, not the count: the judge passed invented dialogue, unasked music and a zoom that
  contradicts its own lens lock until a human read found them.
- **Known limits:** the 8B rung cannot hold the word cap (playbook 05's threshold, measured
  again here). The condense tier sits nearest the ceiling in both modes. No Stage 1 tier asks
  for dialogue, music or cuts; the one-off probe (iteration 12) covered each once, and
  Stage 2 should render one of each.
- **Verbatim check:** scratch `verbatim.py`, every changed file against all four private
  files: 0 shared runs of eight words; the six-word runs left are technical terms
  ("diagonal field of view in degrees", "the shadow side of the subject").
- **Stage 2 is Fabio's** (DeepInfra, billed): the recipe stays `draft`.

### Four checks for Fabio (skill Phase 5 step 7)

1. **Notation moved in both modes:** `Shot N:` / no timestamps / `{}` `<>` `()` / degrees in
   t2v AND i2v (i2v: the lens is held, degrees only on request).
2. **Rules inside later sections are in the inventory:** spot-check D's Seedance-safe
   language, quality suffix and self-QA sections (rows 80-83) and A's ensemble section (105).
3. **Every `confirms` quote is really in the recipe:** R10, R11, R13-R16, R24, R44 quote
   HEAD verbatim (scratch check: 32 quotes, 0 missing).
4. **Rules stated in passing are rows:** e.g. D's "no offscreen voices" inside the gaze section
   (27) and A's "sound must match the body" inside 4.1 (93).

## 8. Close-out (2026-09-25)

- CI on `12920515`: run 36092294650, `completed success`.
- Claim auditor against `12920515`: 38 proven, 0 false, 0 overstated.
- Section 4 proposals, on Fabio's yes: (a) frontmatter-version clause and (c) enhancer-of-record
  clause added to `.claude/rules/engine-recipes.md`; the create-enhancer-recipe skill's Stage 1
  command (SKILL.md, five-case-corpus.md, validation-record.md) now names
  `gemma-4-abliterated-12b`. (b) dropped: already in playbook 08:99.
- Stage 2 renders remain Fabio's; the recipe stays `draft`.
