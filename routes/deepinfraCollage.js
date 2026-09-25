/**
 * Several reference images as ONE picture, for a cloud model whose endpoint takes one
 * (MPI-919).
 *
 * DeepInfra exposes a single `image` field for the whole Nano Banana family, on every
 * route (measured 2026-09-25: a list is a 422, and the OpenAI edits route with repeated
 * parts bills and keeps only the LAST). Google's model reads several references fine,
 * so the references travel as one sheet and the prompt says which cell is which.
 *
 * Two images sit side by side; three or four fill a 2x2 grid. Each cell CONTAINS its
 * image (never crops it) on a neutral grey, so nothing the user framed is cut off.
 * Input bills flat per image sent (1120 tokens on lite whatever the size, measured
 * 2026-09-20), so the sheet costs what one reference costs; what each reference loses
 * is resolution, because the model reads the sheet at its own fixed input size.
 */
const sharp = require('sharp');

const MAX_REFS = 4;
const CELL = 1024;
const GUTTER = 16;
const GREY = { r: 128, g: 128, b: 128 };

const WHERE = {
    2: ['on the left', 'on the right'],
    3: ['at the top left', 'at the top right', 'at the bottom left'],
    4: ['at the top left', 'at the top right', 'at the bottom left', 'at the bottom right'],
};

/**
 * @param {string[]} paths - 2..4 image files, in the order the prompt numbers them
 * @returns {Promise<{jpeg:Buffer, width:number, height:number, preamble:string}>}
 *   `width`/`height` are IMAGE 1's upright size: the model follows its input's shape,
 *   so without an explicit ratio a square sheet would come back as a square picture.
 */
async function buildCollage(paths) {
    const refs = paths.slice(0, MAX_REFS);
    const cols = 2;
    const rows = refs.length > 2 ? 2 : 1;

    // `.rotate()` with no angle applies EXIF orientation, so a phone photo sits upright
    // in its cell and image 1's ratio is the one the user sees.
    const cells = await Promise.all(refs.map(p => sharp(p).rotate()
        .resize(CELL, CELL, { fit: 'contain', background: GREY })
        .flatten({ background: GREY })
        .toBuffer()));
    const first = await sharp(refs[0]).rotate().toBuffer({ resolveWithObject: true });

    const jpeg = await sharp({
        create: {
            width: cols * CELL + (cols - 1) * GUTTER,
            height: rows * CELL + (rows - 1) * GUTTER,
            channels: 3,
            background: GREY,
        },
    })
        .composite(cells.map((input, i) => ({
            input,
            left: (i % cols) * (CELL + GUTTER),
            top: Math.floor(i / cols) * (CELL + GUTTER),
        })))
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
    const where = WHERE[count];
    const cells = where.map((w, i) => `Image ${i + 1} ${w}`).join(', ');
    return `The input is a reference sheet holding ${count} separate images on a grey background: ${cells}. `
        + 'Image 1 is the picture to edit. Answer with ONE single picture based on Image 1, '
        + 'never a grid, a collage or a sheet. Instruction: ';
}

module.exports = { buildCollage, collagePreamble, MAX_REFS };
