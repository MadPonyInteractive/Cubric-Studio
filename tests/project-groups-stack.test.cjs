/**
 * project-groups-stack.test.cjs — MPI-949 Phase 3.
 *
 * A Gallery stack run fills a NEW result stack. When the project is CLOSED by the time a
 * result lands, POST /project-groups writes the card, and the card joins the stack's
 * `members` inside the route's one writer. The renderer's copy of that stack is frozen
 * at dispatch, so a client-side merge would let N results erase each other's membership.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');
const express = require('express');

const router = require('../routes/projects.js');

async function withProject(itemGroups, fn) {
    const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi949-'));
    await fs.writeJson(path.join(folderPath, 'project.json'), { id: 'p1', itemGroups });
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(router);
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise(r => server.once('listening', r));
        const url = `http://127.0.0.1:${server.address().port}/project-groups`;
        const post = groups => fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath, groups }),
        });
        const read = async () => (await fs.readJson(path.join(folderPath, 'project.json'))).itemGroups;
        await fn({ post, read });
    } finally {
        server.close();
        await fs.remove(folderPath);
    }
}

const resultStack = { id: 's1', type: 'stack', kind: 'image', members: [], history: [], expected: 3 };

test('results landing in a closed project each join the result stack, none lost', async () => {
    await withProject([resultStack, { id: 'g-old', history: ['x'] }], async ({ post, read }) => {
        // Two results posted one after the other, as two finished jobs would.
        assert.equal((await post([{ id: 'r1', history: ['i1'], stackId: 's1' }])).status, 200);
        assert.equal((await post([{ id: 'r2', history: ['i2'], stackId: 's1' }])).status, 200);

        const groups = await read();
        const stack = groups.find(g => g.id === 's1');
        assert.deepEqual(stack.members, ['r1', 'r2']);
        assert.equal(stack.expected, 3, 'the route never settles a stack - the renderer does');
        assert.equal(groups.find(g => g.id === 'r1').stackId, 's1');

        // Re-posting a card (a history run on a member) must not list it twice.
        await post([{ id: 'r1', history: ['i1', 'i3'], stackId: 's1' }]);
        assert.deepEqual((await read()).find(g => g.id === 's1').members, ['r1', 'r2']);
    });
});

test('a card whose stack is gone still lands, as a card', async () => {
    await withProject([{ id: 'g-old', history: ['x'] }], async ({ post, read }) => {
        assert.equal((await post([{ id: 'r1', history: ['i1'], stackId: 'gone' }])).status, 200);
        const groups = await read();
        assert.deepEqual(groups.map(g => g.id), ['r1', 'g-old']);
    });
});
