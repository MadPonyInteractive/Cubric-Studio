'use strict';

// MPI-1279 (Fabio, 2026-10-24): on a photo edit Cosmo took Klein 9B (rank 3), then Qwen Edit,
// past Qwen-Image 2.1 and FLUX.3 Klein. The Model rule lets an op whose note "matches the ask"
// beat the rank, so an edit note must never sell what every editor does, and never steer
// away from the top ranks.

const test = require('node:test');
const assert = require('node:assert/strict');

const { MODELS } = require('../js/data/modelConstants/models.js');
const { opPriority } = require('../js/data/modelConstants/modelPriority.js');

const editOps = MODELS.flatMap((m) => (m.supportedOps || []).map((op) => ({ id: m.id, op, p: opPriority(m.id, op) })))
    .filter((e) => e.p?.task === 'edit' && !e.p.paid);

test('the edit ranking is Qwen-Image 2.1, FLUX.3 Klein, then Klein 9B', () => {
    assert.equal(opPriority('qwen-image-2-1', 'edit').rank, 1);
    assert.equal(opPriority('flux3-klein', 'edit').rank, 2);
    assert.equal(opPriority('klein-9b', 'kleinEdit').rank, 3);
});

test('no edit note sells a strength a photo edit always asks for', () => {
    assert.ok(editOps.length >= 8, `${editOps.length} local edit ops`);
    for (const { id, op, p } of editOps) {
        assert.doesNotMatch(p.note || '', /likeness|identity|strongest|most realistic/i, `${id}:${op}`);
    }
});

test('the top two read as editors for any edit, not as something to avoid', () => {
    const qwen = opPriority('qwen-image-2-1', 'edit').note;
    assert.doesNotMatch(qwen, /not for commercial use|never the default/);
    assert.match(qwen, /say so when the user mentions selling or client work/);
    assert.match(opPriority('flux3-klein', 'edit').note, /edits one picture, or up to ten/);
});

test('a one-image editor names the multi-picture editors in rank order, FLUX.3 included', () => {
    for (const id of ['boogu-edit-high', 'boogu-edit-balanced']) {
        const note = opPriority(id, 'edit').note;
        assert.match(note, /the Qwen-Image 2\.1 edit, else the FLUX\.3 Klein edit, else kleinEdit/, id);
    }
});
