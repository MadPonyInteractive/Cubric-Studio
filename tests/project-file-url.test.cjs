'use strict';

// services/projectFileUrl.js — the one /project-file?path= <-> disk path conversion
// (AUDIT D2). The bug it closes (AUDIT B1): eleven route copies ran decodeURIComponent
// on URLSearchParams.get('path'), which had already decoded, so a `%` in a filename
// broke crop, reverse, extract, trim, GIF and combine.

const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { projectFileUrl, projectFileUrlBusted, projectFilePath, diskPathOf } = require('../services/projectFileUrl');

const ROOT = path.resolve(os.tmpdir(), 'cubric proj');

// Names that broke, or would break, a hand-rolled conversion.
const NAMES = [
    'plain.png',
    '100%.mp4',          // a lone % — threw under a double decode
    'a%20b.png',         // a literal "%20" — became a space under a double decode
    'a & b.png',         // & ends a query value if left unencoded
    'take #2.mp4',       // # starts a fragment if left unencoded
    'one+two.png',       // + reads as a space to URLSearchParams if left unencoded
    'with space.webp',
    'Ünïcødé 写真 🎬.png',
    'percent%2Fslash.png',
];

test('a built URL round-trips back to the exact path, for every awkward name', () => {
    for (const name of NAMES) {
        const p = path.join(ROOT, 'Media', name);
        const url = projectFileUrl(p);
        assert.strictEqual(projectFilePath(url), p, name);
        assert.strictEqual(diskPathOf(url), p, name);
        // Extra params after the path — the cache-buster and the download name.
        assert.strictEqual(projectFilePath(`${url}&v=1712345678901`), p, `${name} &v=`);
        assert.strictEqual(projectFilePath(`${url}&filename=x.png`), p, `${name} &filename=`);
        // With an origin, as /llm/ and /project/snapshot hand back.
        assert.strictEqual(projectFilePath(`http://127.0.0.1:3000${url}`), p, `${name} origin`);
    }
});

test('the busted URL carries the mtime and still decodes to the path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfu-'));
    const file = path.join(dir, '100% & #1.png');
    fs.writeFileSync(file, 'x');
    try {
        const url = projectFileUrlBusted(file);
        const mtime = Math.round(fs.statSync(file).mtimeMs);
        assert.ok(url.endsWith(`&v=${mtime}`), url);
        assert.strictEqual(projectFilePath(url), file);
        // A file not there yet still yields a usable URL.
        assert.ok(projectFileUrlBusted(path.join(dir, 'missing.png')).endsWith('&v=0'));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('an absolute disk path passes through diskPathOf; anything else is null', () => {
    const abs = path.join(ROOT, 'Media', '100%.mp4');
    assert.strictEqual(projectFilePath(abs), null);
    assert.strictEqual(diskPathOf(abs), abs);
    for (const bad of ['', null, undefined, 42, {}, 'Media/rel.png', './rel.png',
        '/project-file?other=1', 'http://x/elsewhere?path=%2Ftmp%2Fa.png']) {
        assert.strictEqual(diskPathOf(bad), null, JSON.stringify(bad));
    }
});

test('a malformed escape in a hand-written URL does not throw', () => {
    assert.strictEqual(projectFilePath('/project-file?path=/tmp/100%.mp4'), '/tmp/100%.mp4');
});

test('no route decodes the path a second time', () => {
    // The shape of the B1 bug: decodeURIComponent wrapped around searchParams.get('path').
    const doubled = /decodeURIComponent\(\s*[\w.]+\.searchParams\.get\(\s*['"]path['"]/;
    const offenders = [];
    for (const dir of ['routes', 'services']) {
        for (const f of fs.readdirSync(path.join(__dirname, '..', dir))) {
            if (!/\.(c|m)?js$/.test(f)) continue;
            const src = fs.readFileSync(path.join(__dirname, '..', dir, f), 'utf8');
            if (doubled.test(src)) offenders.push(`${dir}/${f}`);
        }
    }
    assert.deepStrictEqual(offenders, []);
});
