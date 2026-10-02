/**
 * Media labels speak the family accents (MPI-1012, Fabio 2026-10-02): Image = Prism rose
 * (--vision-accent), Video = Reel orange (--video-accent), Audio = Vinyl green
 * (--accent-audio), on the section headers of the Model picker, the Model Library and the
 * Flow Library, and on the per-tile media flags and badges. Before this, image was grey,
 * video frost-blue and audio warn-amber. DESIGN.md § The accent family.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const C = path.resolve(__dirname, '../js/components');
const read = (p) => fs.readFileSync(path.join(C, p), 'utf8');
const TOKEN = { image: '--vision-accent', video: '--video-accent', audio: '--accent-audio' };
const colourOf = (css, selector) => {
    const m = new RegExp(`${selector.replace(/[.\-]/g, '\\$&')}\\s*\\{\\s*color:\\s*var\\((--[a-z-]+)\\)`).exec(css);
    return m && m[1];
};

const HEADS = [
    ['Compounds/MpiModelPicker/MpiModelPicker.css', '.mpi-model-picker__media-head'],
    ['Organisms/MpiModelManager/MpiModelManager.css', '.mpi-model-library__media-head'],
    ['Organisms/MpiFlowLibrary/MpiFlowLibrary.css', '.mpi-flow-library__media-head'],
];

test('every media section header takes its family accent', () => {
    for (const [file, base] of HEADS) {
        const css = read(file);
        for (const [media, token] of Object.entries(TOKEN)) {
            assert.strictEqual(colourOf(css, `${base}--${media}`), token, `${file} ${media}`);
        }
    }
});

test('tile media flags and badges take the same accents', () => {
    const css = read('Primitives/MpiTileSheet/MpiTileSheet.css');
    const flag = { image: 'mediaImage', video: 'mediaVideo', audio: 'mediaAudio' };
    for (const [media, token] of Object.entries(TOKEN)) {
        assert.strictEqual(colourOf(css, `.mpi-tile__flag--${flag[media]}`), token, `flag ${media}`);
        assert.strictEqual(colourOf(css, `.mpi-tile__badge--${media}`), token, `badge ${media}`);
    }
});

test('the JS emits a modifier for every media, not only video', () => {
    for (const [file, base] of [
        ['Compounds/MpiModelPicker/MpiModelPicker.js', 'mpi-model-picker__media-head'],
        ['Organisms/MpiModelManager/MpiModelManager.js', 'mpi-model-library__media-head'],
        ['Organisms/MpiFlowLibrary/MpiFlowLibrary.js', 'mpi-flow-library__media-head'],
    ]) {
        assert.match(read(file), new RegExp(`${base}--\\$\\{`), file);
    }
    assert.match(read('Primitives/MpiTileSheet/MpiTileSheet.js'), /mpi-tile__badge--\$\{m\}/);
});
