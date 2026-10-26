/**
 * phone-route.test.cjs — MPI-1300. The phone page is dev-gated: served on a source run,
 * 404 on a release (CUBRIC_DEV_MODE=off stands in for a stamped build hash), and the
 * static server never hands phone.html out past the gate.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const express = require('express');

async function get(urlPath) {
    const app = express();
    app.use(require('../routes/phone.js'));
    app.use(express.static(path.join(__dirname, '..')));   // same order as server.js
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}${urlPath}`);
        return { status: res.status, body: await res.text() };
    } finally {
        await new Promise(r => server.close(r));
    }
}

test('dev run: /phone serves the phone page', async () => {
    delete process.env.CUBRIC_DEV_MODE;
    const res = await get('/phone');
    assert.equal(res.status, 200);
    assert.match(res.body, /js\/phone\/init\.js/);
});

test('release: /phone and /phone.html are 404', async (t) => {
    process.env.CUBRIC_DEV_MODE = 'off';
    t.after(() => { delete process.env.CUBRIC_DEV_MODE; });
    assert.equal((await get('/phone')).status, 404);
    assert.equal((await get('/phone.html')).status, 404, 'the static server must not serve it past the gate');
});

test('release: the phone data routes are 404 too', async (t) => {
    process.env.CUBRIC_DEV_MODE = 'off';
    t.after(() => { delete process.env.CUBRIC_DEV_MODE; });
    assert.equal((await get('/phone/cards?folderPath=C%3A%5Cx')).status, 404);
    assert.equal((await get('/phone/agent-prefs')).status, 404);
});

test('/phone/cards: every version newest card first, archived and stack shells left out', async (t) => {
    const fs = require('node:fs');
    const os = require('node:os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phone-cards-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'Media', '.meta'), { recursive: true });
    const meta = (id, type) => fs.writeFileSync(path.join(dir, 'Media', '.meta', `${id}.json`),
        JSON.stringify({ id, type, filePath: `/project-file?path=${id}`, thumbPath: `/project-file?path=${id}.thumb`, prompt: `p ${id}` }));
    meta('a1', 'image'); meta('a2', 'image'); meta('v1', 'video');
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ itemGroups: [
        { id: 'old', type: 'image', name: 'Old', createdAt: '2026-01-01', history: ['a1', 'a2'], selectedIndex: 1 },
        { id: 'vid', type: 'video', name: 'Clip', createdAt: '2026-02-01', history: ['v1', 'gone'] },
        { id: 'arch', type: 'image', name: 'Gone', createdAt: '2026-03-01', archived: true, history: ['a1'] },
        { id: 'stk', type: 'stack', kind: 'image', createdAt: '2026-04-01', members: ['old'], history: [] },
    ] }));
    const res = await get(`/phone/cards?folderPath=${encodeURIComponent(dir)}`);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.deepEqual(body.cards.map(c => c.groupId), ['vid', 'old']);
    assert.deepEqual(body.counts, { all: 2, image: 1, video: 1 });
    assert.equal(body.cards[1].versions.length, 2);
    assert.equal(body.cards[1].selected, 1, 'the version the card is showing');
    assert.equal(body.cards[0].versions.length, 1, 'a version whose sidecar is gone is dropped');
    assert.equal(body.cards[1].versions[0].thumb, '/project-file?path=a1.thumb');

    const videos = JSON.parse((await get(`/phone/cards?folderPath=${encodeURIComponent(dir)}&kind=video`)).body);
    assert.deepEqual(videos.cards.map(c => c.groupId), ['vid'], 'kind filters before paging');
    assert.equal(videos.total, 1);
});

test('/phone/cards: a relative folderPath is refused', async () => {
    const res = await get('/phone/cards?folderPath=relative');
    assert.equal(res.status, 400);
});

test('server.js registers the phone route before the static server', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const phone = src.indexOf("require('./routes/phone')");
    assert.ok(phone > 0, 'routes/phone is registered');
    assert.ok(phone < src.indexOf('express.static(__dirname)'), 'before express.static');
});
