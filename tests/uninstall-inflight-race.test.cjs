'use strict';

// MPI-1142 — an uninstall must not delete a dep that an install STARTED DURING the
// uninstall counts on. Measured live 2026-10-16: uninstalling Krea 2 on a busy Pod took
// 191 s (one wrapper delete per dep); Krea 2 NSFW was installed meanwhile, found four
// shared style LoRAs still on the volume and skipped them, then the uninstall loop —
// working from a shared-dep snapshot taken before that install existed — deleted them.
// Drives the REAL route over a stubbed wrapper, registering the second install from
// inside the first delete.

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1142-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const remoteModels = require('../routes/remoteModels.js');
const dm = require('../routes/downloadManager.js');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { resolveFullUniverse } = require('../js/data/modelConstants/resolveModelDeps.js');
const { DEPS } = require('../js/data/modelConstants/dependencies.js');
const { getUniversalWorkflowDepIds } = require('../routes/shared.js');

const MODEL = MODELS.find(m => m.id === 'boogu-edit-balanced');
const UNIVERSAL = new Set(getUniversalWorkflowDepIds());
const DELETABLE = resolveFullUniverse(MODEL, null, 'remote').filter(id => !UNIVERSAL.has(id));
const LATE = DELETABLE[DELETABLE.length - 1];

let present = new Set();
let onFirstDelete = null;
remoteModels.isRemoteActive = () => true;
remoteModels.remoteModelsCheck = async (models) => {
    const results = {};
    for (const m of models || []) {
        const deps = (m.deps || []).map(d => ({ ...d, installed: present.has(d.id) }));
        results[m.id] = { deps, installed: deps.length > 0 && deps.every(d => d.installed) };
    }
    return { results };
};
remoteModels.remoteUninstallDep = async (dep) => {
    if (onFirstDelete) { const f = onFirstDelete; onFirstDelete = null; f(); }
    if (!present.has(dep.id)) return { status: 'not_found', id: dep.id };
    present.delete(dep.id);
    return { status: 'deleted', id: dep.id };
};

test('remote uninstall keeps a dep an install started mid-uninstall relies on', async (t) => {
    assert.ok(DELETABLE.length >= 2, 'fixture model needs two deletable deps');
    const app = express();
    app.use(express.json());
    app.use(dm.router);
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    t.after(() => { server.close(); dm._installStore.dropModel('__late_install__'); });

    present = new Set(DELETABLE);
    onFirstDelete = () => dm._installStore.registerModelJob({
        modelId: '__late_install__',
        engine: 'remote',
        deps: [{ depId: LATE, type: DEPS[LATE].type, size: DEPS[LATE].size || '', alreadyInstalled: true }],
    });

    const res = await fetch(`http://127.0.0.1:${server.address().port}/comfy/models/uninstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: MODEL.id, dependencies: DELETABLE.map(id => DEPS[id]), deleteFiles: true }),
    });
    const data = await res.json();

    assert.ok(present.has(LATE), 'the dep the late install counted on must still be on the volume');
    assert.ok(data.keptShared.some(k => k.depId === LATE), 'and reported as kept-shared');
    assert.ok(!data.removed.some(r => r.depId === LATE));
});
