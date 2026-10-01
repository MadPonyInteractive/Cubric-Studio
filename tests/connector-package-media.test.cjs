'use strict';

/**
 * MPI-1004 — a Flow PACKAGE's media slots reach the agent's catalogue. A package registers
 * its op in the renderer only, and `GET /connector/models` read the server's static
 * registry, so every packaged Flow listed no media: DramaBox's voice slot (and the library
 * voices folded onto it) never reached the agent (Fabio live, 2026-10-01).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1004-'));
process.env.APP_USER_DATA = ROOT;
const FLOWS_DIR = path.join(ROOT, 'user_flows');

const uf = require('../services/userFlows');
const connector = require('../routes/connector');
const known = uf.loadKnown();

function writePackage(id, { broken = false } = {}) {
    const dir = path.join(FLOWS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'flow.json'), JSON.stringify({
        schema: uf.SCHEMA, id, version: '1.0.0', compat: { minAppVersion: '1.0.0' },
        flow: {
            title: 'Test Flow', description: 'A package made by a test.', preview: 'preview.webp',
            requiredModels: [[...known.models][0]], mediaType: 'image', type: 'edit',
            steps: [{ fields: [{ id: 'Input_Box.x', type: 'number' }] }],
        },
        op: {
            label: 'Flow: Test', mediaType: 'image', injector: 'headSwap',
            mediaInputs: [{ key: 'image1', mediaType: 'image', title: broken ? 'No_Such_Node' : 'Input_Image', required: true }],
        },
    }));
    fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify({
        1: { class_type: 'MpiLoadImageFromPath', inputs: { string: '' }, _meta: { title: 'Input_Image' } },
        2: { class_type: 'MpiBox', inputs: { x: 0, y: 0, width: 8, height: 8 }, _meta: { title: 'Input_Box' } },
        3: { class_type: 'MpiBoxCrop', inputs: { image: ['1', 0], box: ['2', 0] }, _meta: { title: 'crop' } },
        4: { class_type: 'SaveImage', inputs: { images: ['3', 0], filename_prefix: 'x' }, _meta: { title: 'Output_Image' } },
    }));
    fs.writeFileSync(path.join(dir, 'preview.webp'), 'x');
}

test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

test('an installed package\'s media slots are in the catalogue, under the renderer\'s key', async () => {
    writePackage('good-flow');
    writePackage('broken-flow', { broken: true });
    assert.deepEqual(uf.scanUserFlows().find((f) => f.id === 'good-flow').errors, [], 'fixture must be a valid package');

    const registry = await connector.commandRegistry();
    assert.deepEqual(connector.mediaRolesFor(registry, 'user:good-flow', null),
        [{ role: 'image1', type: 'image', required: true }]);
    assert.deepEqual(connector.mediaRolesFor(registry, 'user:broken-flow', null), [], 'an invalid package registers nothing');
    assert.ok(Object.keys(registry.COMMANDS).length > 20, 'the built-in ops are still there');
});

test('a package removed while the app runs leaves the catalogue', async () => {
    writePackage('gone-flow');
    assert.equal(connector.mediaRolesFor(await connector.commandRegistry(), 'user:gone-flow', null).length, 1);
    fs.rmSync(path.join(FLOWS_DIR, 'gone-flow'), { recursive: true });
    assert.deepEqual(connector.mediaRolesFor(await connector.commandRegistry(), 'user:gone-flow', null), []);
});
