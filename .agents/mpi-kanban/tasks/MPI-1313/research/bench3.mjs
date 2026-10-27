// MPI-1313 bench: FLUX.3 Klein Turbo edit, Fabio's robot-crew panel 1, the 5 FULL sheets + set + clapperboard.
// Hand-written prompts, no app wiring:
//   T  = what the app sends today for a boxed edit: prompt + keep line + [{id,bbox,desc}], first ref's size
//   R  = BFL i2i_bbox record: "<cosmo_1> from <ref_image_0>" + [{id,from,src_bbox,tgt_bbox,desc}], first ref's size
//   R16= R at custom size 16:9 1k
// usage: node bench3.mjs <url> <T,R,R16> <seed,seed>
import fs from 'fs';

const [url, variantArg, seedArg] = process.argv.slice(2);
const OLD = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/fccf5520-1b1a-482b-b241-599567504f91/scratchpad/bench2/state.json';
const st = JSON.parse(fs.readFileSync(OLD, 'utf8'));
const refs = st.refs.Q; // full sheets 013,012,011,010,009 + t2i_011 set + t2i_012 clapperboard

const C = [ // id, name, ref index, tgt bbox [y0,x0,y1,x1], desc
    ['cosmo_1', 'Cosmo', 0, [320, 30, 960, 230], 'Cosmo, a small dusty-pink robot with a boxy monitor head showing a simple pixel face, two antennae, a C logo on his chest, short legs'],
    ['lingo_1', 'Lingo', 1, [300, 300, 720, 450], 'Lingo, a dusty-pink robot whose head is a black speech-bubble screen with a yellow ">_" prompt, a keyboard on his chest, yellow bands on his arms, short legs'],
    ['prism_1', 'Prism', 2, [260, 470, 640, 590], 'Prism, a dusty-pink robot whose head is a camera with one big pink lens, a small camera on his chest, short legs'],
    ['vinyl_1', 'Vinyl', 4, [330, 600, 960, 770], 'Vinyl, a dusty-pink robot with a black screen face showing a teal sound wave, large teal headphones, a round speaker grille on his chest, short legs'],
    ['reel_1', 'Reel', 3, [300, 780, 960, 980], 'Reel, a dusty-pink robot whose head is a film-strip frame with a play symbol and an orange handle, a clapperboard emblem on his chest, orange joints, short legs'],
];
const SCENE = '2D flat cartoon film still, wide establishing shot of the Film Set, lit by harsh overhead studio lights, early afternoon. ';

// T: today's text (bench 1 D wording) with <id> cites, the keep line and today's rows.
const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
const T_TEXT = SCENE + [
    'Cosmo <cosmo_1> stands frame-left, holding the Clapperboard, facing the action.',
    'Lingo <lingo_1> sits on a stool frame-background, typing on his flat chest.',
    'Prism <prism_1> lurks at the edge of the set, frame-background, half-hidden behind a light stand, his large pink camera eye turned toward the main group.',
    'Vinyl <vinyl_1> stands near Reel, adjusting large teal headphones, holding a boom microphone.',
    'Reel <reel_1> operates a large film camera on a tripod frame-right, film strips hanging from his head.',
    ...C.map(([, n, r]) => `${n} is the character from the ${ORD[r]} image.`),
    'The Film Set is the place from the sixth image and the Clapperboard the object from the seventh image.',
    'Keep everything else in the picture exactly the same.',
].join(' ') + ' ' + JSON.stringify(C.map(([id, , , bbox, desc]) => ({ id, bbox, desc })));

// R: BFL's i2i_bbox annotation voice: "Create ..." when references are drawn into a new frame,
// each item cited with its id and its reference token; rows carry from + src_bbox (whole sheet) + tgt_bbox.
const R_TEXT = 'Create a 2D flat cartoon film still: a wide establishing shot of the film set <film_set_1> from <ref_image_5>, lit by harsh overhead studio lights. ' + [
    'Cosmo <cosmo_1> from <ref_image_0> stands frame-left, holding the clapperboard <clapperboard_1> from <ref_image_6>, facing the action.',
    'Lingo <lingo_1> from <ref_image_1> sits on a stool in the background, typing on his flat chest.',
    'Prism <prism_1> from <ref_image_2> lurks at the edge of the set in the background, half-hidden behind a light stand, his pink camera eye turned toward the group.',
    'Vinyl <vinyl_1> from <ref_image_4> stands near Reel, adjusting his teal headphones, holding a boom microphone.',
    'Reel <reel_1> from <ref_image_3> operates a large film camera on a tripod frame-right.',
].join(' ') + ' ' + JSON.stringify([
    { id: 'film_set_1', from: 'ref_image_5', src_bbox: [0, 0, 1000, 1000], tgt_bbox: [0, 0, 1000, 1000], desc: 'The film set: a studio stage with a glowing green screen, light stands and cables.' },
    ...C.map(([id, , r, tgt, desc]) => ({ id, from: `ref_image_${r}`, src_bbox: [0, 0, 1000, 1000], tgt_bbox: tgt, desc: desc + '.' })),
    { id: 'clapperboard_1', from: 'ref_image_6', src_bbox: [0, 0, 1000, 1000], tgt_bbox: [560, 150, 700, 260], desc: 'A black and white film clapperboard.' },
]);

const V = {
    T: { positive: T_TEXT },
    R: { positive: R_TEXT },
    R16: { positive: R_TEXT, ratio: '16:9', qualityTier: '1k' },
};

async function post(path, body) {
    const res = await fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { status: res.status, text }; }
}

const media = refs.map((u, i) => ({ role: i ? `inputImage${i + 1}` : 'inputImage', url: u }));
for (const v of variantArg.split(',')) {
    console.log(v, 'PROMPT:', V[v].positive);
    for (const seed of seedArg.split(',').map(Number)) {
        const t = Date.now();
        const out = await post('/connector/generate', {
            modelId: 'flux3-klein', turbo: true, operation: 'edit', media, seed, ...V[v],
            folderPath: st.folderPath, cardName: `1313 ${v} s${seed}`,
        });
        console.log(v, seed, Math.round((Date.now() - t) / 1000) + 's', out.ok ? out.output?.filePath : JSON.stringify(out).slice(0, 400));
    }
}
