// MPI-1096: two-character sheets via the app's own composer (routes/ingredientsSheet.js), so the bench sees what the app sends.
const fs = require('fs');
const { buildReferenceSheet } = require('C:/AI/Mpi/Cubric-Vision/routes/ingredientsSheet.js');

const M = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media';
const O = 'C:/AI/MPI-1096-out/sheets';
const WOMAN = 'a young woman with long silvery-white hair in thick Dutch braids hanging to mid-thigh, light green eyes, wearing a pink halter bikini top with a metal ring at the chest';
const MAN = 'a man with short dark textured hair and a dark manicured beard, wearing a tight grey crew-neck t-shirt, charcoal cargo pants, grey hiking boots and a black backpack with thick shoulder straps';
const SCENE = 'A static medium two-shot on a sun-dappled dirt path between tall pines, the woman on the left and the man on the right, both framed from the waist up and facing each other a few feet apart, their faces clearly visible. The woman with the braids narrows her eyes and says flatly, "You again?" and the man in the grey t-shirt smirks and answers, "That\'s right." Warm shafts of golden light fall through the canopy across their faces. Birdsong and wind in the pines.';

const two = `<Picture 1> ${WOMAN}\n<Picture 2> ${MAN}\n\n${SCENE}`;
const four = `<Picture 1> character: ${WOMAN}\n<Picture 2> character: ${MAN}\n<Picture 3> character: a close-up of the same woman's face, her light green eyes and silver braids\n<Picture 4> character: a close-up of the same man's face, his dark swept hair and manicured beard\n\n${SCENE}`;

const cases = {
    shared: { pics: ['flowCharacterSheet_031.png', 'flowCSFI_007.png'], prompt: two, w: 960, h: 512 },
    // same, but both lines tagged `character:` so the composer treats the man as a character too
    sharedchar: { pics: ['flowCharacterSheet_031.png', 'flowCSFI_007.png'], prompt: two.replace('<Picture 1> ', '<Picture 1> character: ').replace('<Picture 2> ', '<Picture 2> character: '), w: 960, h: 512 },
    faces: { pics: ['flowCharacterSheet_031.png', 'flowCSFI_007.png', 'face:woman_face.png', 'face:man_face.png'], prompt: four, w: 960, h: 512 },
    high: { pics: ['flowCharacterSheet_031.png', 'flowCSFI_007.png'], prompt: two, w: 1216, h: 704 },
};

(async () => {
    const out = {};
    for (const [k, c] of Object.entries(cases)) {
        const pictures = c.pics.map((p, i) => ({ tag: i + 1, path: p.startsWith('face:') ? `${O}/${p.slice(5)}` : `${M}/${p}` }));
        const r = await buildReferenceSheet(pictures, c.prompt, { width: c.w, height: c.h });
        fs.writeFileSync(`${O}/two_${k}.png`, r.png);
        out[k] = { sheet: `two_${k}.png`, prompt: r.prompt, w: c.w, h: c.h, cells: r.cells, coverage: r.coverage };
    }
    // Mixed bench (Fabio 2026-10-13): 2 characters + a setting, side-on walk. Shared = the app today (all tagged).
    const BEACH_PATH = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/X2.3 references/Media/imported_006.jpg';
    const BEACH = 'a tropical turquoise ocean meeting a white sandy shoreline under a clear blue sky';
    const WALK = 'A side-on tracking shot along the white sandy shoreline: the woman and the man walk side by side from left to right at the water\'s edge, talking, the turquoise sea behind them. The camera tracks with them at waist height, both seen in profile and three-quarter view, faces clearly visible. The woman with the braids glances at him and says flatly, "You again?" and the man in the grey t-shirt smirks and answers, "That\'s right." Waves wash over their feet, gulls call in the distance.';
    const mix = `<Picture 1> character: ${WOMAN}\n<Picture 2> character: ${MAN}\n<Picture 3> setting: ${BEACH}\n\n${WALK}`;
    for (const [k, w, h] of [['mixshared', 960, 512], ['mixsharedhi', 1216, 704]]) {
        const pictures = [`${M}/flowCharacterSheet_031.png`, `${M}/flowCSFI_007.png`, BEACH_PATH].map((path, i) => ({ tag: i + 1, path }));
        const r = await buildReferenceSheet(pictures, mix, { width: w, height: h });
        fs.writeFileSync(`${O}/two_${k}.png`, r.png);
        out[k] = { sheet: `two_${k}.png`, prompt: r.prompt, w, h, cells: r.cells, coverage: r.coverage };
    }
    const split = `### Reference Sheet Description\n**First Reference (Character):** ${WOMAN}\n**Second Reference (Character):** ${MAN}\n**Third Reference (Setting):** ${BEACH}\n### Target Description\n${WALK}`;
    out.mixsplit = { guides: ['woman_raw', 'man_raw', 'beach_raw'], w: 960, h: 512, prompt: split };
    out.mixsplithi = { guides: ['woman_raw', 'man_raw', 'beach_raw'], w: 1216, h: 704, prompt: split };
    // The raw portrait beach padded to 16:9 = mostly BLACK guide -> an all-black clip (seed 1). Setting filled instead:
    out.mixsplitfix = { guides: ['woman_raw', 'man_raw', 'beach_169'], w: 960, h: 512, prompt: split };
    out.mixsplitfixhi = { guides: ['woman_raw', 'man_raw', 'beach_169'], w: 1216, h: 704, prompt: split };
    // 3 guides broke (cuts between characters at Medium, a ghosted copy of the sheets at High). Two character guides
    // held in the forest test, so: characters as guides, the setting in TEXT only.
    const two2 = `### Reference Sheet Description\n**First Reference (Character):** ${WOMAN}\n**Second Reference (Character):** ${MAN}\n### Target Description\nThe setting is ${BEACH}. ${WALK}`;
    out.mix2g = { guides: ['woman_raw', 'man_raw'], w: 960, h: 512, prompt: two2 };
    out.mix2ghi = { guides: ['woman_raw', 'man_raw'], w: 1216, h: 704, prompt: two2 };
    // two separate guides: each character's sheet whole, one guide each (prompt names both references)
    out.guides = { guides: ['woman_raw', 'man_raw'], sheets: ['flowCharacterSheet_031.png', 'flowCSFI_007.png'], w: 960, h: 512,
        prompt: `### Reference Sheet Description\n**First Reference (Character):** ${WOMAN}\n**Second Reference (Character):** ${MAN}\n### Target Description\n${SCENE}` };
    fs.writeFileSync(`${O}/two_cases.json`, JSON.stringify(out, null, 2));
    for (const [k, v] of Object.entries(out)) console.log(k, v.coverage ?? '', (v.prompt || '').split('\n').slice(0, 5).join(' | ').slice(0, 300));
})();
