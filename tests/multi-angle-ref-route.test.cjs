/**
 * multi-angle-ref-route.test.cjs — MPI-1039. POST /flows/multi-angle/ref pads the square doll ref to the
 * pass's input size with repeated edge pixels, writes it under <project>/.flow-refs/multi-angle/, and
 * reuses that file on the next call.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs-extra');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { scratchDir } = require('./helpers/scratch.cjs');

async function post(body) {
    const app = express();
    app.use(express.json());
    app.use(require('../routes/multiAngle.js'));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        const r = await fetch(`http://127.0.0.1:${server.address().port}/flows/multi-angle/ref`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        return { status: r.status, body: await r.json() };
    } finally {
        await new Promise(r => server.close(r));
    }
}

/** A source picture in a scratch project folder. */
async function project(width = 1600, height = 800) {
    const root = await scratchDir('multi-angle-');
    const source = path.join(root, 'Media', 'source.png');
    await fs.ensureDir(path.dirname(source));
    await sharp({ create: { width, height, channels: 3, background: '#406080' } }).png().toFile(source);
    return { root, source };
}

const diskPath = url => decodeURIComponent(url.match(/[?&]path=([^&]+)/)[1]);

test('pads the doll to the source size with its edge pixels, under .flow-refs', async () => {
    const { root, source } = await project();
    const { status, body } = await post({ ref: 'room/back', imagePath: source, folderPath: root });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.ok, true, JSON.stringify(body));
    assert.deepEqual([body.width, body.height], [1600, 800]);
    const out = diskPath(body.url);
    assert.equal(out, path.join(root, '.flow-refs', 'multi-angle', 'room_back_1600x800.png'));

    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [1600, 800]);
    // The 800x800 square sits at x 400..1199; every padded column repeats the square's edge column.
    const px = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x + 1) * info.channels)];
    for (const y of [0, 400, 799]) {
        assert.deepEqual(px(0, y), px(400, y), `left pad, row ${y}`);
        assert.deepEqual(px(399, y), px(400, y), `left pad, row ${y}`);
        assert.deepEqual(px(1599, y), px(1199, y), `right pad, row ${y}`);
    }
});

test('a /project-file URL works, and a second call reuses the file', async () => {
    const { root, source } = await project(768, 1024);
    const imagePath = `/project-file?path=${encodeURIComponent(source)}`;
    const first = (await post({ ref: 'plain/front_lo', imagePath, folderPath: root })).body;
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.deepEqual([first.width, first.height], [768, 1024]);
    const out = diskPath(first.url);
    const stamp = new Date('2020-01-01T00:00:00Z');
    await fs.utimes(out, stamp, stamp);
    const second = (await post({ ref: 'plain/front_lo', imagePath, folderPath: root })).body;
    assert.equal(second.url, first.url);
    assert.equal((await fs.stat(out)).mtimeMs, stamp.getTime(), 'not written again');
});

test('bad input answers with a code, and writes nothing', async () => {
    const { root, source } = await project();
    const cases = [
        [{ ref: '../secret', imagePath: source, folderPath: root }, 400, 'BAD_REQUEST'],
        [{ ref: 'room/back', imagePath: source, folderPath: 'relative/folder' }, 400, 'BAD_REQUEST'],
        [{ ref: 'room/back', imagePath: path.join(root, 'gone.png'), folderPath: root }, 404, 'NOT_FOUND'],
        [{ ref: 'room/no_such_stop', imagePath: source, folderPath: root }, 404, 'NOT_FOUND'],
    ];
    for (const [body, status, code] of cases) {
        const res = await post(body);
        assert.equal(res.status, status, JSON.stringify(body));
        assert.equal(res.body.error?.code, code, JSON.stringify(res.body));
    }
    assert.equal(await fs.pathExists(path.join(root, '.flow-refs')), false);
});
