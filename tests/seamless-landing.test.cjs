/**
 * seamless-landing.test.cjs — Make seamless D2 (MPI-1101): every window pastes back and lands.
 *
 * The routes run for real over HTTP (prepare -> window -> paste -> finish), with the engine's
 * output served from a URL exactly as ComfyUI's /view hands it to commandExecutor. What a run
 * lands must be the WHOLE picture at its source size, changed inside the band and byte-identical
 * outside it. The client half is pinned by source: generationService's payload is a whitelist,
 * so a key it does not forward never reaches `_finishGeneration` at all.
 *
 * Run: node --test tests/seamless-landing.test.cjs
 */
'use strict';

const test    = require('node:test');
const assert  = require('node:assert/strict');
const fs      = require('node:fs');
const os      = require('node:os');
const path    = require('node:path');
const express = require('express');
const sharp   = require('sharp');

const ROOT = path.join(__dirname, '..');
const src  = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Start the seamless routes plus a /view stand-in for the engine; resolves { base, close, viewDir }. */
function _serve() {
    const viewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seamless-view-'));
    const app = express();
    app.use(express.json());
    app.use(require(path.join(ROOT, 'routes', 'seamless.js')));
    app.get('/view/:name', (req, res) => res.sendFile(path.join(viewDir, req.params.name)));
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => resolve({
            base: `http://127.0.0.1:${server.address().port}`,
            viewDir,
            close: () => new Promise(r => server.close(r)),
        }));
    });
}

const _post = async (base, route, body) => (await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})).json();

const _diskPath = (url) => decodeURIComponent(/[?&]path=([^&]+)/.exec(url)[1]);

test('a whole run over HTTP lands the full picture, changed only inside the band', async () => {
    const { base, viewDir, close } = await _serve();
    try {
        // A left-to-right gradient, so an unchanged pixel is provably the source's own.
        const W = 2048, H = 512;
        const raw = Buffer.alloc(W * H * 3);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 3;
            raw[o] = x & 255; raw[o + 1] = (x >> 3) & 255; raw[o + 2] = y & 255;
        }
        const sourcePath = path.join(viewDir, 'source.png');
        await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toFile(sourcePath);

        const prep = await _post(base, '/seamless/prepare', { sourcePath, handles: { left: 10, right: 10, top: 0, bottom: 0 } });
        assert.equal(prep.ok, true, JSON.stringify(prep));
        assert.ok(prep.windows.length >= 1);

        const landed = [];
        for (const { i } of prep.windows) {
            const win = await _post(base, '/seamless/window', { runId: prep.runId, i });
            assert.equal(win.ok, true, JSON.stringify(win));
            assert.match(win.image, /^\/project-file\?path=/, 'the cut travels as a /project-file URL');
            assert.match(win.mask, /^\/project-file\?path=/);
            // The "engine" paints the whole window pure magenta, at the cut's size.
            const { width, height } = await sharp(_diskPath(win.image)).metadata();
            const name = `out_${i}.png`;
            await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 0, b: 255 } } })
                .png().toFile(path.join(viewDir, name));

            const pasted = await _post(base, '/seamless/paste', { runId: prep.runId, i, viewUrl: `${base}/view/${name}` });
            assert.equal(pasted.ok, true, JSON.stringify(pasted));
            const fin = await _post(base, '/seamless/finish', { runId: prep.runId });
            assert.equal(fin.ok, true, JSON.stringify(fin));
            assert.match(fin.url, /^http:\/\/127\.0\.0\.1:\d+\/project-file\?path=/, 'absolute, so save-generation can stream it');
            landed.push(_diskPath(fin.url));
        }
        assert.equal(new Set(landed).size, landed.length, 'each finish writes its own file');

        const out = await sharp(landed[landed.length - 1]).raw().toBuffer({ resolveWithObject: true });
        assert.equal(out.info.width, W, 'source width');
        assert.equal(out.info.height, H, 'source height');
        const at = (x, y) => [...out.data.subarray((y * W + x) * out.info.channels, (y * W + x) * out.info.channels + 3)];
        const was = (x, y) => [x & 255, (x >> 3) & 255, y & 255];
        // The middle of the picture is outside both edge bands: untouched, to the byte.
        for (let x = Math.round(W * 0.3); x < Math.round(W * 0.7); x += 7) {
            for (const y of [0, 255, H - 1]) assert.deepEqual(at(x, y), was(x, y), `pixel ${x},${y} outside the band moved`);
        }
        // The seam itself (the picture's own left and right edges) was repainted.
        assert.deepEqual(at(0, 200), [255, 0, 255], 'left edge repainted');
        assert.deepEqual(at(W - 1, 200), [255, 0, 255], 'right edge repainted');
    } finally {
        await close();
    }
});

test('paste refuses a missing viewUrl, finish needs only the run id', async () => {
    const { base, close } = await _serve();
    try {
        const r = await _post(base, '/seamless/paste', { runId: '00000000-0000-0000-0000-000000000000', i: 0 });
        assert.equal(r.ok, false);
        assert.equal(r.error.code, 'BAD_REQUEST');
        const f = await _post(base, '/seamless/finish', { runId: '../../etc' });
        assert.equal(f.ok, false, 'a run id that climbs out of the scratch dir is refused');
    } finally {
        await close();
    }
});

test('generationService forwards the window to the executor (its payload is a whitelist)', () => {
    assert.match(src('js/services/generationService.js'), /seamless: config\.seamless \|\| null,/);
});

test('commandExecutor pastes every window of a pastesToWorkingCopy op, then lands the whole picture', () => {
    const s = src('js/services/commandExecutor.js');
    assert.match(s, /COMMANDS\[workingPayload\.operation\]\?\.pastesToWorkingCopy && workingPayload\.seamless && outputUrls\.length/);
    assert.match(s, /outputUrls\.splice\(0, outputUrls\.length, await _pasteSeamlessWindow\(outputUrls\[0\], workingPayload\.seamless\)\)/);
    assert.match(s, /await post\('\/seamless\/paste', \{ runId, i, viewUrl \}\);\s*return \(await post\('\/seamless\/finish', \{ runId \}\)\)\.url;/);
});

test('a later window lands on pass 1\'s card and replaces its version; runPass never reaches the sidecar', () => {
    const s = src('js/services/flowService.js');
    assert.match(s, /export function submitFlowGeneration\(flowOrId, \{ runPass = null, \.\.\.inputs \} = \{\}/,
        'runPass is pulled off before `snapshot` (the sidecar\'s flowInputs) is taken');
    assert.match(s, /\.\.\.\(nextPass\?\.replaceItemId \? landOnCard\(done\?\.group, runLanding, runOriginProject\) : \{\}\)/);
    assert.match(s, /\.\.\.\(runPass\?\.replaceItemId \? \{ replaceItemId: runPass\.replaceItemId \} : \{\}\)/);
});
