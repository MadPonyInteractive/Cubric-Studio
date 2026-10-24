/**
 * flow-dev-gate.test.cjs — MPI-1231: a `devOnly` FlowDef exists in source runs only.
 * `APP_CONFIG.dev_mode` is read once at import, so each config is loaded in its own
 * child process: `CUBRIC_DEV_MODE=off` is the `npm start nodev` switch, a release build
 * as users see it.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REGISTRY = 'file:///' + path.join(__dirname, '..', 'js/data/flowsRegistry.js').replace(/\\/g, '/');

/** The Flows one config sees, read through every public door. */
function flowsIn(devMode) {
    const script = `import(${JSON.stringify(REGISTRY)}).then(m => {
        const ids = m.FLOWS.map(f => f.id);
        process.stdout.write(JSON.stringify({
            ids,
            devOnly: m.FLOWS.filter(f => f.devOnly).map(f => f.id),
            listed: m.listFlows().map(f => f.id),
            found: ids.filter(id => m.getFlowById(id)).length,
        }));
    });`;
    const env = { ...process.env, CUBRIC_DEV_MODE: devMode ? '' : 'off' };
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' }));
}

test('a release config has no devOnly Flow, and every door agrees', () => {
    const rel = flowsIn(false);
    assert.deepStrictEqual(rel.devOnly, []);
    assert.deepStrictEqual(rel.listed, rel.ids);
    assert.strictEqual(rel.found, rel.ids.length);
});

test('a source run sees every release Flow plus exactly the devOnly ones', () => {
    const dev = flowsIn(true);
    const rel = flowsIn(false);
    assert.deepStrictEqual(dev.ids.filter(id => !dev.devOnly.includes(id)), rel.ids);
    for (const id of dev.devOnly) assert.ok(!rel.ids.includes(id), `${id} leaked into a release config`);
});
