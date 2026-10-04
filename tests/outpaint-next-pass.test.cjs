/**
 * outpaint-next-pass.test.cjs — MPI-1011. Pass 2 of a big outpaint is built from pass 1's
 * FINISHED ITEM, as flowService hands it over.
 *
 * Both twins (`MpiBaseFlow._planPasses` and agentDispatch `_nextPassFor`) give the
 * completion's `item` to `composeNextPass`. That item is a `createImageItem` whose file is
 * `filePath`; it has no `url`. Reading `url` returned null, the next pass "could not start",
 * and the frame said "Generation failed." with pass 1's card in the gallery (Fabio's live
 * run, 2026-10-02: a 9:21 frame stopped at 1024x1706). The geometry tests never saw it
 * because they never build an item.
 *
 * WHY A FAKE CANVAS: bare Node has no canvas or Image; the fakes record the frame size and
 * where the previous result is drawn, which is all `composeNextPass` decides.
 *
 * Run: node --test tests/outpaint-next-pass.test.cjs
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const esm = p => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

const IMAGES = new Map();
class FakeImage {
    set src(url) {
        setImmediate(() => {
            const hit = IMAGES.get(url);
            if (!hit) { this.onerror?.(new Error(`no such image: ${url}`)); return; }
            this.naturalWidth = this.width = hit.w;
            this.naturalHeight = this.height = hit.h;
            this.onload?.();
        });
    }
}
const canvases = [];
class FakeCanvas {
    constructor() { this.draws = []; this.sized = []; canvases.push(this); }
    getContext() {
        return {
            drawImage: (img, x, y, dw, dh) => {
                this.draws.push({ w: img.naturalWidth, h: img.naturalHeight, x, y });
                this.sized.push({ x, y, dw, dh });
            },
        };
    }
    toBlob(cb) { cb(new Blob([new Uint8Array(4)], { type: 'image/png' })); }
}
globalThis.document = { createElement: (tag) => { assert.strictEqual(tag, 'canvas'); return new FakeCanvas(); } };
globalThis.Image = FakeImage;
globalThis.EventSource ||= class { addEventListener() {} close() {} };

test('pass 2 is composed from the finished item flowService hands over', async () => {
    const { createImageItem } = await esm('js/data/projectModel.js');
    const { composeNextPass } = await esm('js/components/Organisms/MpiStepCrop/MpiStepCrop.js');

    // Pass 1 of Fabio's run: a 1024x1024 source in a 9:21 frame (1024x2389) plans
    // 1024x1706, then the full frame. The item is built the way generationService builds it.
    const filePath = '/project-file?path=C%3A%2Fproj%2FMedia%2FflowOutpaint_009.png';
    IMAGES.set(filePath, { w: 1024, h: 1706 });
    const item = createImageItem({ filePath, pixelDimensions: { w: 1024, h: 1706 } });
    const prev = { x: 0, y: -341, w: 1024, h: 1706 };
    const next = { x: 0, y: -682, w: 1024, h: 2389 };

    const file = await composeNextPass(item, prev, next);

    assert.ok(file, 'a finished item must compose the next pass, or the run stops after pass 1');
    const canvas = canvases.at(-1);
    assert.deepEqual([canvas.width, canvas.height], [1024, 2389], 'the next pass is the full frame');
    assert.deepEqual(canvas.draws, [{ w: 1024, h: 1706, x: 0, y: 341 }],
        'pass 1 sits where its frame sits inside the next one');
});

// MPI-1014: the graph scales its input to 1 MP on load, so a frame past the engine cap was
// only ever a bigger canvas (~1 GB at 16K) — and the reason a 16K photo could not be
// outpainted at all (refused past 16384).
test('a 16K frame is composed at most 4096 on its long edge, the source scaled into it', async () => {
    const { composePaddedImage } = await esm('js/components/Organisms/MpiStepCrop/MpiStepCrop.js');
    const url = '/project-file?path=C%3A%2Fproj%2FMedia%2Fbig_001.png';
    IMAGES.set(url, { w: 16384, h: 10240 });

    const file = await composePaddedImage({ url }, { crop: { x: 0, y: -2048, w: 16384, h: 14336 } });

    assert.ok(file, 'a 16K photo grown past 16384 is composed, never refused');
    const canvas = canvases.at(-1);
    assert.deepEqual([canvas.width, canvas.height], [4096, 3584]);
    assert.deepEqual(canvas.sized.at(-1), { x: 0, y: 512, dw: 4096, dh: 2560 });
});
