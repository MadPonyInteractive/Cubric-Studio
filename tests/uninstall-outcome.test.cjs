'use strict';
// js/utils/uninstallOutcome.js — the count behind both uninstall toasts (Model Library and
// Flow Library). AUDIT B4: the Flow Library's own copy lacked the MPI-1076 guard, so a
// click that removed nothing while files were kept still toasted "uninstalled".

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const load = () => import(pathToFileURL(path.join(ROOT, 'js', 'utils', 'uninstallOutcome.js')).href);
const absent = (n) => Array.from({ length: n }, () => ({ reason: 'already-absent' }));

test('removed files count as gone', async () => {
    const { uninstallOutcome } = await load();
    assert.deepEqual(uninstallOutcome({ removed: ['a', 'b'] }),
        { gone: 2, keptFiles: 0, keptTotal: 0, keptForModel: 0 });
});

test('already-absent files are gone, not kept (MPI-469)', async () => {
    const { uninstallOutcome } = await load();
    const out = uninstallOutcome({ keptModelFiles: absent(2) });
    assert.equal(out.gone, 2);
    assert.equal(out.keptTotal, 0);
});

test('removed nothing while files were kept: nothing freed, even with absent files (MPI-1076)', async () => {
    const { uninstallOutcome } = await load();
    const out = uninstallOutcome({ keptModelFiles: absent(1), keptShared: [{ sharedWith: ['Krea2'] }] });
    assert.equal(out.gone, 0);
    assert.equal(out.keptForModel, 1);
});

test('engine-owned kept files never count as shared with a model', async () => {
    const { uninstallOutcome } = await load();
    const out = uninstallOutcome({ removed: ['a'], keptUniversal: ['vae'], keptPipInstalls: ['pkg'] });
    assert.equal(out.gone, 1);
    assert.equal(out.keptTotal, 2);
    assert.equal(out.keptForModel, 0);
});

test('both libraries toast from this one count', () => {
    for (const rel of ['js/components/Organisms/MpiModelManager/MpiModelManager.js',
        'js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js']) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.ok(src.includes('uninstallOutcome('), `${rel} must use uninstallOutcome`);
        assert.ok(!src.includes(".reason === 'already-absent'"), `${rel} must not count absent files itself`);
    }
});
