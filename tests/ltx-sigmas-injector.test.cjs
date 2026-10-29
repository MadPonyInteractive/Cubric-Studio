// MPI-578 — ltxSigmasInjector scales the schedule each graph BAKES, so the Upscale
// Video Flow's two arms (LTX 2.3, MiniMax H3) keep their own measured shapes behind
// one Denoise slider. The baked schedule is what the default start (0.675) runs.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const graph = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'comfy_workflows', f), 'utf8'));
const sigmasOf = g => Object.values(g).find(n => n?._meta?.title === 'Input_Sigmas').inputs.sigmas;

async function inject(file, denoise) {
    const { injectLtxSigmas } = await import('../js/services/workflowInjectors/ltxSigmasInjector.js');
    const g = graph(file);
    injectLtxSigmas(g, denoise === undefined ? {} : { Input_Denoise: denoise });
    return sigmasOf(g);
}

test('the default start runs each arm on its own baked schedule', async () => {
    assert.equal(await inject('ltx_video_upscale.json', 0.675), '0.6750, 0.5757, 0.3350, 0.0000');
    assert.equal(await inject('ltx_video_upscale.json'), '0.6750, 0.5757, 0.3350, 0.0000',
        'no value falls back to the default, never a degenerate schedule');
    assert.equal(await inject('flow_h3_upscale.json', 0.675), '0.9035, 0.6316, 0.3158, 0.0000');
});

test('the LTX rungs MPI-568 measured are unchanged to within 0.0001', async () => {
    const rungs = {
        0.6: [0.6, 0.5118, 0.2978, 0],
        0.75: [0.75, 0.6397, 0.3723, 0],
        0.85: [0.85, 0.725, 0.4219, 0],
    };
    for (const [start, want] of Object.entries(rungs)) {
        const got = (await inject('ltx_video_upscale.json', Number(start))).split(',').map(Number);
        got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= 0.0001 + 1e-9,
            `start ${start}: step ${i} is ${v}, measured ${want[i]}`));
    }
});

test('the H3 arm scales its own shape and never passes sigma 1', async () => {
    const top = (await inject('flow_h3_upscale.json', 0.85)).split(',').map(Number);
    assert.equal(top[0], 1, 'past pure noise is not a schedule');
    assert.ok(top.every(v => v <= 1));
    const low = (await inject('flow_h3_upscale.json', 0.5)).split(',').map(Number);
    assert.ok(Math.abs(low[1] / low[0] - 0.6316 / 0.9035) < 0.001, 'the H3 shape, not the LTX one');
});
