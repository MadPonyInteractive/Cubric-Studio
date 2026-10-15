'use strict';

// MPI-1146: a LoRA dropped in Model Settings lands in the open model's own folder
// under loras/ (`subfolder`), created if missing — and the subfolder can never walk
// out of the configured-folder allow-list.

const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

// Own engine + models root before routes/comfy captures them at require time.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cubric-import-subfolder-'));
process.env.CUBRIC_ENGINE_ROOT = path.join(tmp, 'engine');
process.env.CUBRIC_MODELS_ROOT = path.join(tmp, 'models');
fs.mkdirSync(process.env.CUBRIC_ENGINE_ROOT, { recursive: true });

const comfyRouter = require('../routes/comfy');

test('import-model lands a LoRA in its model subfolder and refuses unsafe ones', async () => {
    const lorasDir = path.join(process.env.CUBRIC_MODELS_ROOT, 'loras');
    const src = path.join(tmp, 'my_style.safetensors');
    fs.writeFileSync(src, 'x');

    const app = express();
    app.use(express.json());
    app.use(comfyRouter);
    const server = await new Promise(resolve => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/comfy/import-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: src, targetFolder: lorasDir, bucket: 'loras', ...body }),
    });

    try {
        let res = await post({ subfolder: 'krea-2' });
        assert.equal(res.status, 200);
        assert.ok(fs.existsSync(path.join(lorasDir, 'krea-2', 'my_style.safetensors')), 'copied into loras/krea-2/');

        for (const bad of ['..', '.', '../escape', 'a/b', 'a\\b', '']) {
            res = await post({ subfolder: bad, overwrite: true });
            if (bad === '') { assert.equal(res.status, 200, 'empty subfolder = root'); continue; }
            assert.equal(res.status, 400, `subfolder ${JSON.stringify(bad)} must be refused`);
        }
        assert.ok(!fs.existsSync(path.join(process.env.CUBRIC_MODELS_ROOT, 'escape')));

        res = await post({});
        assert.equal(res.status, 409, 'no subfolder = loras root, where the empty-subfolder run already put it');
    } finally {
        server.close();
    }
});
