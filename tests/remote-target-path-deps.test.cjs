'use strict';

// MPI-595 B1 — Chatter Box and Voice Changer on a RunPod Pod.
//
// Every chatterbox weight is a `targetPath` dep: a BARE filename ('s3gen.pt') plus a fixed
// engine folder ('models/chatterbox/chatterbox_vc'), because the node reads
// `<ComfyUI>/models/chatterbox/<arm>/` and no ComfyUI folder type. The remote path split
// the bare filename into an EMPTY wrapper type, and the wrapper refused all 13 deps with
// `invalid model type` (2.0 smoke, 2026-09-28). Most callers also hand remoteModelsCheck a
// stripped `{ id, type, filename }`, so the fix must work from the dep id alone.

const test = require('node:test');
const assert = require('node:assert/strict');
const { wrapperDepPath, splitDepFilename } = require('../routes/remoteModels.js');
const { DEPS } = require('../js/data/modelConstants/dependencies.js');

// The wrapper's own gates (cubric-vision-pod/wrapper/wrapper.py `_SUBDIR_RE`, `_safe_relpath`).
const WRAPPER_TYPE = /^[A-Za-z0-9_-]+$/;
const safeRel = (p) => p && !p.startsWith('/') && !p.split('/').some((s) => s === '..' || s === '');

const volumeTargetPathDeps = Object.values(DEPS)
    .filter((d) => d && d.targetPath && !d.bakedOnPod && String(d.targetPath).startsWith('models/'));

test('every volume targetPath dep reaches the wrapper with a type it accepts', () => {
    assert.ok(volumeTargetPathDeps.length >= 13, `expected the chatterbox deps, got ${volumeTargetPathDeps.length}`);
    for (const d of volumeTargetPathDeps) {
        const { type, filename } = wrapperDepPath(d);
        assert.match(type, WRAPPER_TYPE, `${d.id}: wrapper type "${type}"`);
        assert.ok(safeRel(filename), `${d.id}: wrapper filename "${filename}"`);
        // Lands where the node reads: mpi_models/<type>/<filename> == models/<...>/<file>.
        assert.equal(`models/${type}/${filename}`, `${d.targetPath}/${d.filename}`, d.id);
    }
});

test('a stripped { id, type, filename } dep resolves the same (most callers strip)', () => {
    const d = DEPS['chatterbox-vc-s3gen'];
    const stripped = { id: d.id, type: d.type, filename: d.filename };
    assert.deepEqual(wrapperDepPath(stripped), { type: 'chatterbox', filename: 'chatterbox_vc/s3gen.pt' });
    // The pre-fix answer, kept as the failure this test exists for.
    assert.equal(splitDepFilename(stripped.filename).type, '');
});

test('an ordinary subdir-filename dep is unchanged', () => {
    const plain = Object.values(DEPS).find((d) => d && !d.targetPath && d.type !== 'custom_nodes'
        && String(d.filename || '').includes('/'));
    assert.deepEqual(wrapperDepPath(plain), splitDepFilename(plain.filename));
});
