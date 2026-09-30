// MPI-970 — a History completion must version the card as it stands NOW, not as it stood
// when the job was queued.
//
// MPI-839 froze the origin project at enqueue (so a render cannot land in a project the
// user switched to) and the two completion branches that version an existing card read
// the card off that frozen copy. With two History jobs queued on one card, job 2 appended
// to the card as it was BEFORE job 1 landed, and `updateGroup` wrote that copy back: job
// 1's version vanished from the card. Both branches now read `_originLive()`: the live
// open project while it IS the origin, the frozen copy only when the origin is closed.
// Source-checked, as `generation-project-pinning.test.cjs` checks the same path.

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'generationService.js'), 'utf8');

test('_originLive is the live project only while it is the origin', () => {
    assert.ok(src.includes('const _originLive = () => (_originIsOpen() ? state.currentProject : _originProject);'),
        '_originLive must hand back the live open project, and the frozen copy for a closed origin');
});

test('both card-versioning completion branches read the card through _originLive', () => {
    assert.ok(!src.includes('(_originProject?.itemGroups'),
        'a completion reads the card off the enqueue-time snapshot again');
    assert.strictEqual(src.match(/\(_originLive\(\)\?\.itemGroups/g)?.length, 2,
        'the replace branch and the existingGroup branch must both read the live card');
});
