// MPI-795. A tool's settings entry is seeded `{}` and only the keys the user
// touched are written, so a stored entry is usually PARTIAL. getToolSettings
// must merge it over the defaults: returning the bare entry handed the crop
// apply path `res_h: undefined` (the panel showed 1080), and the RESOLUTION
// crop silently skipped its resample.

const assert = require('node:assert');
const test = require('node:test');

const DEFAULTS = { family: 'ratio', res_w: 1920, res_h: 1080, divisible_by: 16 };

test('a partial stored entry is filled from the defaults', async () => {
    const { getToolSettings } = await import('../js/data/projectModel.js');
    const project = { toolSettings: { crop: { family: 'resolution', res_w: 1024 } } };

    assert.deepStrictEqual(getToolSettings(project, 'crop', DEFAULTS),
        { family: 'resolution', res_w: 1024, res_h: 1080, divisible_by: 16 });
});

test('no entry, or no toolSettings at all, returns the defaults and never the shared object', async () => {
    const { getToolSettings } = await import('../js/data/projectModel.js');

    for (const project of [{}, { toolSettings: {} }]) {
        const got = getToolSettings(project, 'crop', DEFAULTS);
        assert.deepStrictEqual(got, DEFAULTS);
        assert.notStrictEqual(got, DEFAULTS);
    }
    assert.deepStrictEqual(getToolSettings({}, 'crop'), {});
});
