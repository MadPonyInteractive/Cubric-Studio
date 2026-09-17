// MPI-796. The Resize tool's MP and SCALE types derive width/height from the
// source size and must keep its proportions. MP uses ComfyUI's megapixel
// (1024 x 1024), so 1 MP on a square source is exactly 1024 x 1024.

const assert = require('node:assert');
const test = require('node:test');

test('SCALE divides both sides', async () => {
    const { deriveResizeDims } = await import('../js/utils/ratios.js');
    assert.deepStrictEqual(deriveResizeDims('scale', 3000, 2000, { scale: '1.5' }), { width: 2000, height: 1333 });
    assert.deepStrictEqual(deriveResizeDims('scale', 3000, 2000, { scale: '2' }), { width: 1500, height: 1000 });
    assert.deepStrictEqual(deriveResizeDims('scale', 3000, 2000, { scale: 4 }), { width: 750, height: 500 });
});

test('MP hits the pixel count and keeps the aspect', async () => {
    const { deriveResizeDims } = await import('../js/utils/ratios.js');
    assert.deepStrictEqual(deriveResizeDims('megapixels', 4096, 4096, { megapixels: 1 }), { width: 1024, height: 1024 });

    const { width, height } = deriveResizeDims('megapixels', 4000, 3000, { megapixels: 2 });
    assert.ok(Math.abs(width * height - 2 * 1024 * 1024) / (2 * 1024 * 1024) < 0.005, `${width}x${height}`);
    assert.ok(Math.abs(width / height - 4 / 3) < 0.005, `${width}x${height}`);
});

test('other types, an unknown source, or a bad value derive nothing', async () => {
    const { deriveResizeDims } = await import('../js/utils/ratios.js');
    assert.strictEqual(deriveResizeDims('free', 3000, 2000, { scale: '2', megapixels: 1 }), null);
    assert.strictEqual(deriveResizeDims('sdxl', 3000, 2000, { scale: '2', megapixels: 1 }), null);
    assert.strictEqual(deriveResizeDims('scale', 0, 0, { scale: '2' }), null);
    assert.strictEqual(deriveResizeDims('megapixels', 3000, 2000, { megapixels: 0 }), null);
    assert.strictEqual(deriveResizeDims('scale', 3000, 2000, {}), null);
});
