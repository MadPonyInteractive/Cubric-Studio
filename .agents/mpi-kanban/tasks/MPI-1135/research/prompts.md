# MPI-1135 test prompts (fixed for every arm)

Written once, 2026-10-25, and **never edited between arms**. A change here starts the phase over.
Shape: the shipped H3 recipe (`js/data/recipes/minimax-h3.recipe.js`): look line, `[Shot 1]`,
camera line, `overall_soundscape:`, `non_diegetic_music:`, constraint line. One continuous action
per shot, so no cut times. Every prompt has spoken lines in quotes (delivery written just before
them) AND named scene sounds (Fabio, 2026-10-24). Sound describes the scene, never the mix.

| | |
|---|---|
| Seeds | `1135001`, `1135002` (both, every shot, every arm) |
| Length | `Input_Duration` 4 (s) |
| Size | landscape 1344x768 (A, B, C); portrait 896x1088-class for D, set in its row |
| Stage 1 | turbo on (`Input_is_Turbo` true) in every arm |

## Shot A: run at the camera (t2v, city)

```text
Busy downtown street at golden hour look: warm amber and teal palette, long shadows across the asphalt, mood urgent and breathless, a wide shot on a 35mm lens.
[Shot 1] A young man in a red hoodie and black joggers sprints straight toward the camera down the middle of a long city street, starting as a tiny figure far down the block, arms pumping hard, sneakers slapping the asphalt, passing parked cars and shop fronts as he closes the distance, until his sweating face fills the frame. Running the whole way, he shouts between breaths, panting and desperate, "Hold the door! Please, just hold the door for me!" and, as he reaches the lens, gasping, "I'm here, I'm here, I made it."
The camera holds still at head height as he runs into it, his figure growing from far to medium to a close-up.
overall_soundscape: City traffic rolling past, a car horn, a bus braking at the kerb, music drifting from an open shop doorway, his footsteps pounding on the asphalt, his ragged breathing.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion.
```

## Shot B: side tracking run over obstacles (t2v, city + impacts)

```text
Gritty back-alley parkour look: cool grey and sodium-orange palette, wet concrete, mood tense and kinetic, a medium-wide side shot on a 50mm lens.
[Shot 1] A young woman in a green bomber jacket and cargo trousers sprints from left to right along a narrow city alley, vaulting a metal railing, leaping over a stack of wooden crates and hurdling a dented trash can without breaking stride, her hands slapping the railing as she clears it. Talking the whole way, she calls out over her shoulder, breathless and laughing, "You'll never catch me, not today!" then, landing hard, she turns her head toward the camera and says, panting and grinning, "Told you I was faster."
The camera tracks beside her at a fast, steady speed in a side view, then pushes in hard to a close-up of her face as she lands the last jump.
overall_soundscape: Distant city traffic and a siren beyond the alley walls, faint music from an upstairs window, her trainers hitting wet concrete, the metal railing ringing under her hands, the crates thumping and the trash can clattering as she clears them, her heavy breathing.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion.
```

## Shot C: two characters run into the sea (ref2v, beach)

References: `<Picture 1>` = `flowCharacterSheet_087.png` (the woman), `<Picture 2>` =
`flowCharacterSheet_084.png` (the man). Both stay in Fabio's project; they are scp'd to the Pod,
never copied into git.

```text
Bright tropical beach at midday look: turquoise and white-sand palette, hard sun, spray glittering in the air, mood joyful and loose, a wide shot on a 35mm lens.
Use <Picture 1> as the woman's face, hair, full-body tattoos and wardrobe, and <Picture 2> as the man's face, grey hair, full-body tattoos, wardrobe and brown leather crossbody bag.
[Shot 1] The woman from <Picture 1> and the man from <Picture 2> run side by side down the white sand and straight into the sea, splashing through the shallows as waves break against their legs and spray flies up around them, water streaming down their tattooed arms and backs, the linework on their skin wet and shining. Laughing as she runs, she shouts to him, "Last one in buys dinner!" and he calls back, breathless and laughing, "That's not fair, you started early!" as a wave crashes over them both.
The camera tracks behind and beside them at a steady speed as they run into the water.
overall_soundscape: Waves breaking and hissing back over the sand, water splashing and churning around their legs, a steady sea wind, gulls crying overhead, their bare feet pounding the wet sand.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion.
```

## Shot Cb: Shot C with the character descriptions stripped (ref2v, ours arm only)

Added 2026-10-25 (Fabio): tests the Singularity HF community report that describing a referenced
character damages identity. Shot C with only the looks removed: the reference line names the
role alone, and the beat loses "tattooed" and the wet-linework clause. Everything else verbatim.

```text
Bright tropical beach at midday look: turquoise and white-sand palette, hard sun, spray glittering in the air, mood joyful and loose, a wide shot on a 35mm lens.
Use <Picture 1> as the woman and <Picture 2> as the man.
[Shot 1] The woman from <Picture 1> and the man from <Picture 2> run side by side down the white sand and straight into the sea, splashing through the shallows as waves break against their legs and spray flies up around them, water streaming down their arms and backs. Laughing as she runs, she shouts to him, "Last one in buys dinner!" and he calls back, breathless and laughing, "That's not fair, you started early!" as a wave crashes over them both.
The camera tracks behind and beside them at a steady speed as they run into the water.
overall_soundscape: Waves breaking and hissing back over the sand, water splashing and churning around their legs, a steady sea wind, gulls crying overhead, their bare feet pounding the wet sand.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion.
```

## Shot Cs: Shot Cb plus MiniMax's two reference sections (ref2v, ours arm only)

Added 2026-10-25 (EllipsesMark on the Singularity HF community): name the character in
`subject_definitions`, put only what the reference SHOWS in `retention_analysis` (hair, facial
details), never ethnicity or origin. Format from MiniMax's `ref-en.txt` §2.1 / §4.1
(`MadPony-Identity/research/findings/minimax-h3-ref-en.txt`). The body below the two sections is
Shot Cb byte for byte, so Cs vs Cb isolates the sections and Cb vs C isolates the stripping.
Traits read off the two sheets.

```text
subject_definitions:
<Subject 1> is the woman in <Picture 1>, with a black-to-pink ombre bob and a blunt fringe, brown eyes, a wide smile, a thin gold necklace with a round pendant, black-and-copper ornamental tattoos covering her neck, torso, arms and legs, and a black string bikini.
<Subject 2> is the man in <Picture 2>, with short grey hair, blue-grey eyes, grey stubble, a lean lined face, black-and-copper ornamental tattoos covering his neck, torso, arms and legs, white drawstring shorts, white canvas sneakers and a brown leather crossbody bag.
retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved - her face, ombre bob with fringe, necklace, full-body tattoo linework and black bikini are retained.
<Subject 2> (appears in [Shot 1]): fully_preserved - his face, short grey hair, stubble, full-body tattoo linework, white shorts and brown leather crossbody bag are retained.
Bright tropical beach at midday look: turquoise and white-sand palette, hard sun, spray glittering in the air, mood joyful and loose, a wide shot on a 35mm lens.
Use <Picture 1> as the woman and <Picture 2> as the man.
[Shot 1] The woman from <Picture 1> and the man from <Picture 2> run side by side down the white sand and straight into the sea, splashing through the shallows as waves break against their legs and spray flies up around them, water streaming down their arms and backs. Laughing as she runs, she shouts to him, "Last one in buys dinner!" and he calls back, breathless and laughing, "That's not fair, you started early!" as a wave crashes over them both.
The camera tracks behind and beside them at a steady speed as they run into the water.
overall_soundscape: Waves breaking and hissing back over the sand, water splashing and churning around their legs, a steady sea wind, gulls crying overhead, their bare feet pounding the wet sand.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion.
```

## Shot D: walk-in to a close-up (i2v, beach)

Start frame: `t2i_011.png` (Fabio's Qwen 2.1 project, outside git). Portrait run.

```text
The supplied frame shows a woman in a coral bikini on a white-sand beach: bright turquoise and white palette, soft afternoon sun, mood relaxed and warm.
[Shot 1] She walks slowly toward the camera across the sand, her dark curly hair moving in the wind and the pendant necklace swinging at her chest, until her face fills the frame. Talking to the camera the whole way, she says, warm and teasing, "You should have come with me, the water is perfect today," and, as she reaches the lens, with a soft laugh, "Next time you're coming, no excuses."
The camera holds still as she walks into it, her figure growing from full body to a close-up of her face.
overall_soundscape: Small waves breaking and washing up the sand, gulls calling over the water, a steady sea wind, her bare feet pressing into soft sand.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion.
```
