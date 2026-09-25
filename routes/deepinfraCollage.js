/**
 * Several reference images as ONE picture, for a cloud model whose endpoint takes one
 * (MPI-919).
 *
 * DeepInfra exposes a single `image` field for the whole Nano Banana family, on every
 * route (measured 2026-09-25: a list is a 422, and the OpenAI edits route with repeated
 * parts bills and keeps only the LAST). Google's model reads several references fine,
 * so the references travel as one sheet and the prompt says which cell is which.
 *
 * Image 1 — the picture being edited — takes a big square cell on the left; the others
 * stack in a narrow column on the right. An even 2x2 grid was tried first and lost
 * (2026-09-25, paid A/B on NB2 Lite): at a quarter of the sheet, Lite RE-DREW image 1's
 * scene instead of editing it, and with three references it dropped one of two
 * instructions. The big cell kept the scene and carried out both. Each cell CONTAINS its
 * image (never crops it) on a neutral grey, so nothing the user framed is cut off.
 *
 * Input bills flat per image sent (1120 tokens on lite whatever the size), so the sheet
 * costs what one reference costs.
 */
const sharp = require('sharp');

const MAX_REFS = 4;
const HERO = 1536;
const COLUMN = 640;
const GUTTER = 16;
const GREY = { r: 128, g: 128, b: 128 };

const WHERE = {
    1: ['on the right'],
    2: ['at the top right', 'at the bottom right'],
    3: ['at the top right', 'in the middle right', 'at the bottom right'],
};

function _cell(file, width, height) {
    // `.rotate()` with no angle applies EXIF orientation, so a phone photo sits upright.
    // No pixel ceiling: photographers load 16K frames, and 16384^2 is past sharp's default.
    return sharp(file, { limitInputPixels: false }).rotate()
        .resize(width, height, { fit: 'contain', background: GREY })
        .flatten({ background: GREY })
        .toBuffer();
}

/**
 * @param {string[]} paths - 2..4 image files, in the order the prompt numbers them
 * @returns {Promise<{jpeg:Buffer, width:number, height:number, preamble:string}>}
 *   `width`/`height` are IMAGE 1's upright size: the model follows its input's shape,
 *   so without an explicit ratio the wide sheet would come back as a wide picture.
 */
async function buildCollage(paths) {
    const refs = paths.slice(0, MAX_REFS);
    const others = refs.length - 1;
    const cellHeight = Math.floor((HERO - (others - 1) * GUTTER) / others);

    const [hero, ...column] = await Promise.all(refs.map((p, i) => (i === 0
        ? _cell(p, HERO, HERO)
        : _cell(p, COLUMN, cellHeight))));
    // Header only: decoding image 1 just for its size cost ~800 MB of RAM on a 16K photo.
    // EXIF orientations 5-8 are quarter turns, so the upright size swaps the sides.
    const meta = await sharp(refs[0], { limitInputPixels: false }).metadata();
    const turned = meta.orientation >= 5;
    const first = { info: { width: turned ? meta.height : meta.width, height: turned ? meta.width : meta.height } };

    const jpeg = await sharp({
        create: { width: HERO + GUTTER + COLUMN, height: HERO, channels: 3, background: GREY },
    })
        .composite([
            { input: hero, left: 0, top: 0 },
            ...column.map((input, j) => ({ input, left: HERO + GUTTER, top: j * (cellHeight + GUTTER) })),
        ])
        .jpeg({ quality: 92 })
        .toBuffer();

    return { jpeg, width: first.info.width, height: first.info.height, preamble: collagePreamble(refs.length) };
}

/**
 * What the model is told about the sheet, prepended to the user's own prompt so their
 * "Image 2" still means the second picture they added.
 * @param {number} count - 2..4
 */
function collagePreamble(count) {
    const small = WHERE[count - 1].map((w, j) => `Image ${j + 2} the small one ${w}`).join(', ');
    return `The input is a reference sheet holding ${count} separate images on a grey background: `
        + `Image 1 is the large picture on the left, ${small}. `
        + 'Image 1 is the picture to edit. Answer with ONE single picture based on Image 1, '
        + 'never a grid, a collage or a sheet. Instruction: ';
}

module.exports = { buildCollage, collagePreamble, MAX_REFS };
