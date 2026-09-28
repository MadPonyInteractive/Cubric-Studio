/**
 * MPI-961 experiment, GPU-ON Electron (same launch as perf.cjs, no project):
 * is a canvas -> canvas drawImage downscale mipmapped (no moire), and what does it cost
 * at 16K? A 1px vertical grating fills an N^2 canvas; reduce it to N/level with each
 * smoothing quality, direct and by 2x halving; report grey std (0 = correct) and ms.
 */
const REPO = 'C:/AI/Mpi/Cubric-Vision';
const path = require('path');
const net = require('net');
const freePort = () => new Promise((res, rej) => {
    const p = net.createServer(); p.once('error', rej);
    p.listen(0, '127.0.0.1', () => { const { port } = p.address(); p.close(() => res(port)); });
});
(async () => {
    const port = await freePort();
    process.env.CUBRIC_PORT = String(port);
    const { _electron } = require(REPO + '/node_modules/@playwright/test');
    const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE; delete env.CUBRIC_E2E;
    env.CUBRIC_E2E_USER_DATA = path.join(__dirname, 'runs', `mipq-${Date.now()}`, 'user-data');
    env.APP_DOCUMENTS = path.join(__dirname, 'docs');
    env.CUBRIC_ENGINE_ROOT = path.join(__dirname, 'engine');
    env.CUBRIC_BACKGROUND = '1';
    env.CUBRIC_PORT = String(port);
    const app = await _electron.launch({ args: ['.'], cwd: REPO, env });
    try {
        const win = await shellWindow(app, 60000);
        await new Promise((r) => setTimeout(r, 5000));
        const N = Number(process.argv[2] || 16384);
        const out = await win.evaluate(async (N) => {
            const raf = () => new Promise((r) => requestAnimationFrame(r));
            const src = document.createElement('canvas');
            src.width = N; src.height = N;
            const sctx = src.getContext('2d');
            const tile = document.createElement('canvas'); tile.width = 2; tile.height = 1;
            const tctx = tile.getContext('2d');
            tctx.fillStyle = '#000'; tctx.fillRect(0, 0, 1, 1); tctx.fillStyle = '#fff'; tctx.fillRect(1, 0, 1, 1);
            sctx.fillStyle = sctx.createPattern(tile, 'repeat');
            sctx.fillRect(0, 0, N, N);
            sctx.getImageData(0, 0, 1, 1); // force
            await raf(); await raf();
            const std = (c) => {
                const d = c.getContext('2d').getImageData(c.width / 4, c.height / 4, c.width / 2, c.height / 2).data;
                let s = 0, s2 = 0, n = 0;
                for (let i = 0; i < d.length; i += 4) { s += d[i]; s2 += d[i] * d[i]; n++; }
                const m = s / n; return +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(1);
            };
            const res = [];
            {
                const d = sctx.getImageData(1000, 1000, 256, 64).data;
                let s = 0, s2 = 0, n = 0;
                for (let i = 0; i < d.length; i += 4) { s += d[i]; s2 += d[i] * d[i]; n++; }
                const m = s / n;
                res.push({ how: 'source', mean: +m.toFixed(1), std: +Math.sqrt(s2 / n - m * m).toFixed(1) });
            }
            for (const level of [16, 8, 4]) {
                const w = N / level;
                for (const q of ['low', 'high']) {
                    for (let rep = 0; rep < 2; rep++) {
                        const dst = document.createElement('canvas'); dst.width = w; dst.height = w;
                        const ctx = dst.getContext('2d');
                        ctx.imageSmoothingQuality = q;
                        const a = performance.now();
                        ctx.drawImage(src, 0, 0, w, w);
                        ctx.getImageData(0, 0, 1, 1);
                        const ms = performance.now() - a;
                        res.push({ how: 'direct', level, q, rep, ms: Math.round(ms), std: std(dst) });
                        dst.width = 0;
                    }
                }
                // 2x halving chain from the source
                const a = performance.now();
                let cur = src;
                const tmp = [];
                for (let l = 2; l <= level; l *= 2) {
                    const c = document.createElement('canvas'); c.width = N / l; c.height = N / l;
                    const x = c.getContext('2d'); x.imageSmoothingQuality = 'low';
                    x.drawImage(cur, 0, 0, c.width, c.height); cur = c; tmp.push(c);
                }
                cur.getContext('2d').getImageData(0, 0, 1, 1);
                res.push({ how: 'halving', level, ms: Math.round(performance.now() - a), std: std(cur) });
                for (const c of tmp) c.width = 0;
            }
            src.width = 0;
            return res;
        }, N);
        for (const r of out) console.log(JSON.stringify(r));
    } finally {
        await app.close().catch(() => {});
    }
})();
