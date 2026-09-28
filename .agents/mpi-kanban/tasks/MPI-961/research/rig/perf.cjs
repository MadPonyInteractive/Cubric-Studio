/**
 * MPI-961 Phase 1 rig — GPU-ON Electron (no CUBRIC_E2E), own port, own userData,
 * own APP_DOCUMENTS, empty engine root. One launch per measured config.
 *
 *   node perf.cjs <mode> <target> <tag>
 *     mode   discover | full | decode
 *     target 1k | 4k | 16k | 32k | phone
 *     tag    free label, e.g. idle / busy-llm / busy-video
 */
const REPO = 'C:/AI/Mpi/Cubric-Vision';
const SP = __dirname;
const fs = require('fs');
const path = require('path');
const net = require('net');
const { execFileSync } = require('child_process');

const PROJ = path.join(SP, 'docs', 'Cubric Vision', 'Projects', 'Big Photos Test');
const TARGETS = {
    '1k':    { group: '1eb0b104-20d1-4029-b6d7-88acee700c0a', idx: 0 },
    '4k':    { group: '1eb0b104-20d1-4029-b6d7-88acee700c0a', idx: 1 },
    '16k':   { group: '1eb0b104-20d1-4029-b6d7-88acee700c0a', idx: 2 },
    'phone': { group: 'b19f43b8-a7b5-45e7-8ea0-4ade232a0033', idx: 0 },
    '32k':   { group: '3d940d9b-8185-424b-9016-7f7bac00e550', idx: 0 },
};

const freePort = () => new Promise((res, rej) => {
    const p = net.createServer(); p.once('error', rej);
    p.listen(0, '127.0.0.1', () => { const { port } = p.address(); p.close(() => res(port)); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Number(process.hrtime.bigint() / 1000000n);

function nvsmi() {
    try {
        return execFileSync('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used', '--format=csv,noheader,nounits'], { encoding: 'utf8' }).trim();
    } catch (e) { return 'n/a'; }
}

/** Dedicated GPU memory (MB) per pid from the Windows counter. */
function gpuDedicatedByPid() {
    const ps = "(Get-Counter '\\GPU Process Memory(*)\\Dedicated Usage').CounterSamples | ForEach-Object { $_.InstanceName + '=' + $_.CookedValue }";
    const out = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
    const m = {};
    for (const line of out.split(/\r?\n/)) {
        const r = /^pid_(\d+)_.*=(\d+(?:\.\d+)?)$/.exec(line.trim());
        if (r) m[r[1]] = (m[r[1]] || 0) + Number(r[2]) / 1048576;
    }
    return m;
}

async function memSnapshot(app, label) {
    const metrics = await app.evaluate(({ app: a }) => a.getAppMetrics());
    const vals = [];
    for (let i = 0; i < 3; i++) {
        const g = gpuDedicatedByPid();
        vals.push(metrics.reduce((s, p) => s + (g[p.pid] || 0), 0));
    }
    vals.sort((a, b) => a - b);
    const byType = {};
    for (const p of metrics) {
        const k = p.type;
        byType[k] = byType[k] || { ws: 0, priv: 0 };
        byType[k].ws += p.memory.workingSetSize / 1024;
        byType[k].priv += (p.memory.privateBytes || 0) / 1024;
    }
    const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { wsMB: Math.round(v.ws), privMB: Math.round(v.priv) }]));
    return { label, gpuDedicatedMB: Math.round(vals[1]), procs: round(byType), nvsmi: nvsmi() };
}

async function clearBootModals(win) {
    const backdrops = () => win.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = win.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await win.keyboard.press('Escape');
        await sleep(400);
    }
    return backdrops();
}

/** Grey std of the viewer area (did pixels arrive?). */
async function viewerStd(win) {
    const sharp = require(REPO + '/node_modules/sharp');
    const r = await win.evaluate(() => {
        const v = document.querySelector('.mpi-canvas-viewer');
        if (!v) return null;
        const b = v.getBoundingClientRect();
        return { x: b.left + b.width * 0.25, y: b.top + b.height * 0.25, width: b.width * 0.5, height: b.height * 0.5 };
    });
    if (!r || r.width < 4) return null;
    const png = await win.screenshot({ clip: r, timeout: 120000 });
    const { data } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    let s = 0, s2 = 0;
    for (const v of data) { s += v; s2 += v * v; }
    const mean = s / data.length;
    return Math.sqrt(Math.max(0, s2 / data.length - mean * mean));
}

/** Top self-time frames of a V8 CPU profile (ms), idle dropped. */
function topSelf(profile, n = 12) {
    const byId = new Map(profile.nodes.map((x) => [x.id, x]));
    const self = new Map();
    for (let i = 0; i < profile.samples.length; i++) {
        const nd = byId.get(profile.samples[i]);
        const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000;
        const cf = nd.callFrame;
        if (cf.functionName === '(idle)') continue;
        const url = (cf.url || '').replace(/^.*\/js\//, 'js/').replace(/^.*\//, (s) => s.length > 40 ? '' : s);
        const key = `${cf.functionName || '(anon)'} ${url}${cf.url ? ':' + (cf.lineNumber + 1) : ''}`;
        self.set(key, (self.get(key) || 0) + dt);
    }
    return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${Math.round(v)}ms ${k}`);
}

// In-page helpers, installed once after boot.
const PAGE_HELPERS = () => {
    const P = window.__perf = { longtasks: [], gaps: [] };
    try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) P.longtasks.push({ t: e.startTime, d: e.duration }); })
            .observe({ type: 'longtask', buffered: true });
    } catch (e) { P.ltErr = String(e); }
    // Continuous rAF gap recorder: every frame interval > 50ms is kept.
    let last = performance.now();
    const tick = (t) => { const d = t - last; if (d > 50) P.gaps.push({ t: last, d }); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    P.window = (t0, t1) => ({
        longtaskMs: Math.round(P.longtasks.filter((e) => e.t >= t0 && e.t < t1).reduce((s, e) => s + e.d, 0)),
        longtaskMax: Math.round(Math.max(0, ...P.longtasks.filter((e) => e.t >= t0 && e.t < t1).map((e) => e.d))),
        gapMax: Math.round(Math.max(0, ...P.gaps.filter((e) => e.t >= t0 && e.t < t1).map((e) => e.d))),
        gapCount: P.gaps.filter((e) => e.t >= t0 && e.t < t1).length,
    });
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    P.raf = raf;
    P.stats = (arr) => {
        const a = [...arr].sort((x, y) => x - y);
        const q = (p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
        const mean = a.reduce((s, v) => s + v, 0) / (a.length || 1);
        return { n: a.length, meanFps: +(1000 / mean).toFixed(1), medMs: +q(0.5).toFixed(1), p95Ms: +q(0.95).toFixed(1), maxMs: +a[a.length - 1].toFixed(1) };
    };
    /** Run `step(i)` once per rAF for `ms`; returns frame-interval stats. */
    P.drive = async (ms, step) => {
        const iv = [];
        let prev = await raf();
        const end = prev + ms;
        let i = 0;
        while (true) {
            step(i++);
            const t = await raf();
            iv.push(t - prev);
            prev = t;
            if (t >= end) break;
        }
        return P.stats(iv);
    };
    P.center = () => {
        const c = document.querySelector('.mpi-canvas');
        const b = c.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, el: document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) };
    };
};

(async () => {
    const [mode = 'discover', target = '4k', tag = 'test'] = process.argv.slice(2);
    const port = await freePort();
    process.env.CUBRIC_PORT = String(port);
    const { _electron } = require(REPO + '/node_modules/@playwright/test');
    const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

    const runDir = path.join(SP, 'runs', `${tag}-${mode}-${target}-${Date.now()}`);
    fs.mkdirSync(runDir, { recursive: true });
    fs.mkdirSync(path.join(SP, 'engine'), { recursive: true });

    // The target entry is the card's selected one on open.
    const T = TARGETS[target];
    const pj = path.join(PROJ, 'project.json');
    const proj = JSON.parse(fs.readFileSync(pj, 'utf8'));
    proj.itemGroups.find((g) => g.id === T.group).selectedIndex = T.idx;
    fs.writeFileSync(pj, JSON.stringify(proj, null, 2));

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.CUBRIC_E2E;
    env.CUBRIC_E2E_USER_DATA = path.join(runDir, 'user-data');
    env.APP_DOCUMENTS = path.join(SP, 'docs');
    env.CUBRIC_ENGINE_ROOT = path.join(SP, 'engine');
    env.CUBRIC_BACKGROUND = '1';
    env.CUBRIC_PORT = String(port);

    const R = { mode, target, tag, port, startedAt: new Date().toISOString(), nvsmiStart: nvsmi(), steps: {} };
    const consoleErrors = [], pageErrors = [];
    const app = await _electron.launch({ args: ['.'], cwd: REPO, env });
    const save = () => fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(R, null, 2));
    try {
        const win = await shellWindow(app, 60000);
        win.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`.slice(0, 400)); });
        win.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 400)));
        await sleep(6000);
        R.modalsLeft = await clearBootModals(win);
        await win.evaluate(async () => { const { Events } = await import('/js/events.js'); Events.emit('engine:install-skipped'); });
        await sleep(1000);
        R.modalsLeft2 = await clearBootModals(win);
        R.env = await win.evaluate(() => ({ dpr: devicePixelRatio, w: innerWidth, h: innerHeight, vis: document.visibilityState }));
        R.gpuInfo = await app.evaluate(async ({ app: a }) => { const i = await a.getGPUFeatureStatus(); return i; });
        await win.evaluate(PAGE_HELPERS);
        const cdp = await win.context().newCDPSession(win);
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 500 });

        if (mode === 'decode') {
            // D2 experiment: createImageBitmap of the originals, main-thread block measured by rAF gaps.
            const files = { '16k': 'imageUpscale_002.png', '32k': 'imported_002.jpg', '4k': 'imageUpscale_001.png' };
            for (const [k, f] of Object.entries(files)) {
                const url = `/project-file?path=${encodeURIComponent(path.join(PROJ, 'Media', f))}`;
                R.steps[`decode-${k}`] = await win.evaluate(async (url) => {
                    const P = window.__perf;
                    const t0 = performance.now();
                    const blob = await (await fetch(url)).blob();
                    const t1 = performance.now();
                    const out = { fetchMs: Math.round(t1 - t0), bytes: blob.size };
                    try {
                        const a = performance.now();
                        const bm = await createImageBitmap(blob);
                        const b = performance.now();
                        out.full = { ms: Math.round(b - a), w: bm.width, h: bm.height, ...P.window(a, b + 1) };
                        bm.close();
                    } catch (e) { out.full = { error: String(e) }; }
                    await P.raf(); await P.raf();
                    try {
                        const a = performance.now();
                        const bm = await createImageBitmap(blob, { resizeWidth: 4096, resizeQuality: 'high' });
                        const b = performance.now();
                        out.resized4096 = { ms: Math.round(b - a), w: bm.width, h: bm.height, ...P.window(a, b + 1) };
                        bm.close();
                    } catch (e) { out.resized4096 = { error: String(e) }; }
                    return out;
                }, url);
                save();
            }
            return;
        }

        // ── Open the project (APP_DOCUMENTS is scratch, so the registry write is too).
        const tOpen = now();
        await win.evaluate(async (folderPath) => {
            const { openProject } = await import('/js/services/projectService.js');
            await openProject({ folderPath });
        }, PROJ.replace(/\\/g, '/'));
        R.steps.projectOpenMs = now() - tOpen;
        await sleep(3000);
        R.steps.memBefore = await memSnapshot(app, 'project open, gallery');

        // ROWFIX=1 — the MPI-963 control: History entry rows show their thumbnail instead
        // of the original, so the canvas's own cost is measured without the rows'.
        if (process.env.ROWFIX === '1') {
            R.rowfix = true;
            await win.evaluate(async () => {
                const { state } = await import('/js/state.js');
                const items = state.currentProject.itemGroups.flatMap((g) => g.history);
                const fname = (u) => decodeURIComponent(String(u)).split(/[\\/]/).pop().split('&')[0];
                const fix = (img) => {
                    if (!img.classList?.contains('mpi-history-list__thumb') || img.dataset.rowfix) return;
                    const it = items.find((i) => i.filePath && fname(i.filePath) === fname(img.getAttribute('src') || ''));
                    const t = it && (it.thumbPathLg || it.thumbPath);
                    if (t) { img.dataset.rowfix = '1'; img.src = t; }
                };
                new MutationObserver((ms) => {
                    for (const m of ms) {
                        if (m.type === 'attributes') fix(m.target);
                        for (const n of m.addedNodes || []) {
                            if (n.nodeType !== 1) continue;
                            fix(n);
                            n.querySelectorAll?.('img.mpi-history-list__thumb').forEach(fix);
                        }
                    }
                }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
            });
        }

        // ── (a) Open History on the target entry.
        await cdp.send('Profiler.start');
        const t0page = await win.evaluate((gid) => {
            const t = performance.now();
            import('/js/router.js').then(({ navigate, PAGE_GROUP_HISTORY }) => navigate(PAGE_GROUP_HISTORY, { groupId: gid }));
            return t;
        }, T.group);
        const tNav = now();
        const open = { rowsDoneMs: null, baseLoadedMs: null, visibleMs: null, rows: null, polls: 0 };
        while (now() - tNav < 180000) {
            const s = await win.evaluate(() => {
                const blk = document.querySelector('.mpi-group-history-block');
                if (!blk) return { blk: false };
                const base = document.querySelector('#base-img');
                const cv = document.querySelector('.mpi-canvas');
                const spin = document.querySelector('.mpi-canvas-viewer__spinner--visible');
                const rows = [...blk.querySelectorAll('img')].filter((i) => i.id !== 'base-img' && i.id !== 'masked-img');
                return {
                    blk: true,
                    mode: document.querySelector('.mpi-history-tools')?.getActiveMode?.(),
                    base: (base && base.complete) ? { c: true, w: base.naturalWidth, kind: 'preview-img' }
                        : (cv && cv.img && cv.img.complete && !spin) ? { c: true, w: cv.img.width, kind: 'canvas' } : null,
                    rows: rows.map((i) => ({ c: i.complete, w: i.naturalWidth, cls: i.className, src: (i.currentSrc || i.src).slice(-70) })),
                };
            }).catch((e) => ({ err: String(e) }));
            open.polls++;
            const t = now() - tNav;
            if (s.rows && s.rows.length && open.rowsDoneMs === null && s.rows.every((r) => r.c)) { open.rowsDoneMs = t; open.rows = s.rows; }
            if (s.base && s.base.c && open.baseLoadedMs === null) { open.baseLoadedMs = t; open.base = s.base; open.landedMode = s.mode; }
            if (open.baseLoadedMs !== null && open.visibleMs === null) {
                const std = await viewerStd(win).catch(() => null);
                if (std !== null && std > 3) { open.visibleMs = now() - tNav; open.visibleStd = +std.toFixed(1); }
            }
            if (open.rowsDoneMs !== null && open.visibleMs !== null) break;
            if (open.baseLoadedMs !== null && open.base && open.base.w === 0) { open.baseBroken = true; break; }
            await sleep(100);
        }
        open.page = await win.evaluate((t0) => window.__perf.window(t0, performance.now()), t0page);
        {
            const { profile } = await cdp.send('Profiler.stop');
            fs.writeFileSync(path.join(runDir, 'open.cpuprofile'), JSON.stringify(profile));
            open.cpuTop = topSelf(profile);
        }
        R.steps.open = open;
        await sleep(2000);
        R.steps.memPrompt = await memSnapshot(app, 'History, Prompt mode (preview <img>)');
        save();

        if (mode === 'discover') {
            R.discover = await win.evaluate(() => ({
                slots: [...document.querySelectorAll('.mpi-history-tools__slot')].map((s) => ({
                    mode: s.dataset.mode, btns: [...s.querySelectorAll('.mpi-history-tools__btn')].map((b) => b.dataset.info),
                })),
                strip: [...document.querySelectorAll('.mpi-history-tools__strip .mpi-history-tools__btn')].map((b) => b.dataset.info),
                imgs: [...document.querySelectorAll('.mpi-group-history-block img')].map((i) => i.className + ' ' + i.id),
            }));
            await win.screenshot({ path: path.join(runDir, 'discover.png') });
            return;
        }

        // The rail's own setMode runs the same _activate() a click does, minus the
        // disabled gate (Prompt is disabled here: no model on an empty engine root).
        const clickTool = (m) => win.evaluate((m) => {
            const rail = document.querySelector('.mpi-history-tools');
            if (!rail?.setMode) throw new Error('no rail setMode');
            const t = performance.now();
            rail.setMode(m);
            return t;
        }, m);
        /**
         * Rail switch timed in-page by rAF: readyMs = the first frame on which the target
         * state holds; frameMs = two frames after that (a blocked main thread delays both).
         * Then a screenshot proves pixels (screenshotMs = how long the compositor took).
         * A CDP CPU profile of the whole switch names where the long tasks go.
         */
        async function timeSwitch(m, wantMode) {
            await cdp.send('Profiler.start');
            const r = await win.evaluate(async ({ m, want }) => {
                const P = window.__perf;
                const rail = document.querySelector('.mpi-history-tools');
                const cond = () => {
                    const c = document.querySelector('.mpi-canvas');
                    const spin = document.querySelector('.mpi-canvas-viewer__spinner--visible');
                    const base = document.querySelector('#base-img');
                    if (want === 'prompt') return !spin && !c && base && base.complete;
                    return !spin && c && c.img && c.img.width > 0 && c.activeMode === want;
                };
                const t0 = performance.now();
                rail.setMode(m);
                let readyAt = null;
                while (performance.now() - t0 < 180000) {
                    await P.raf();
                    if (cond()) { readyAt = performance.now(); break; }
                }
                await P.raf(); await P.raf();
                const done = performance.now();
                return { mode: m, readyMs: readyAt && Math.round(readyAt - t0), frameMs: Math.round(done - t0), ...P.window(t0, done) };
            }, { m, want: wantMode });
            const { profile } = await cdp.send('Profiler.stop');
            fs.writeFileSync(path.join(runDir, `switch-${m}-${Date.now()}.cpuprofile`), JSON.stringify(profile));
            r.cpuTop = topSelf(profile);
            const ts = now();
            const std = await viewerStd(win).catch(() => null);
            r.screenshotMs = now() - ts; r.std = std && +std.toFixed(1);
            return r;
        }

        // ── (e) landed mode (Crop here) -> Mask brush: canvas to canvas, no remount
        R.steps.switchToMask = await timeSwitch('maskBrush', 'mask');
        await sleep(2000);
        R.steps.memMask = await memSnapshot(app, 'History, Mask mode (MpiCanvas)');
        R.steps.canvasDims = await win.evaluate(() => {
            const c = document.querySelector('.mpi-canvas');
            return { img: [c.img.width, c.img.height], canvases: [...c.querySelectorAll('canvas')].map((x) => `${x.className || x.id}:${x.width}x${x.height}`), scale: c.scale };
        });
        save();

        // ── (b) one draw() in isolation
        R.steps.draw = await win.evaluate(async () => {
            const P = window.__perf; const c = document.querySelector('.mpi-canvas');
            const js = [], frame = [];
            for (let i = 0; i < 10; i++) {
                await P.raf();
                const a = performance.now(); c.draw(); const b = performance.now();
                await P.raf(); const f = performance.now();
                js.push(b - a); frame.push(f - a);
            }
            const med = (x) => +[...x].sort((p, q) => p - q)[Math.floor(x.length / 2)].toFixed(1);
            // The same frame with ONLY the stack's CSS transform nudged (what _applyTransform does).
            const stack = c.querySelector('canvas').parentElement;
            const base = stack.style.transform;
            const tf = [];
            for (let i = 0; i < 10; i++) {
                await P.raf();
                const a = performance.now();
                stack.style.transform = base + ` translate(${i % 2}px, 0px)`;
                await P.raf(); tf.push(performance.now() - a);
            }
            stack.style.transform = base;
            // Idle frame interval for reference
            const idle = await P.drive(1000, () => {});
            return { jsMedMs: med(js), jsMaxMs: +Math.max(...js).toFixed(1), toNextFrameMedMs: med(frame), transformOnlyToNextFrameMedMs: med(tf), idleFrames: idle };
        });
        save();

        // ── (c) wheel zoom with Space held (Mask mode: a bare wheel resizes the brush),
        // 3 x 3 s, one wheel tick per frame, alternating 4 in / 4 out around fit
        R.steps.wheel = [];
        for (let rep = 0; rep < 3; rep++) {
            await win.keyboard.down('Space');
            R.steps.wheel.push(await win.evaluate(async () => {
                const P = window.__perf; const { x, y, el } = P.center(); const c = document.querySelector('.mpi-canvas');
                const s0 = c.scale; let sMax = s0;
                const st = await P.drive(3000, (i) => {
                    el.dispatchEvent(new WheelEvent('wheel', { deltaY: (Math.floor(i / 4) % 2) ? 100 : -100, clientX: x, clientY: y, bubbles: true, cancelable: true }));
                    sMax = Math.max(sMax, c.scale);
                });
                return { ...st, scale0: +s0.toFixed(3), scaleMax: +sMax.toFixed(3) };
            }));
            await win.keyboard.up('Space');
            await sleep(500);
        }
        // reset view
        await win.evaluate(() => document.querySelector('.mpi-canvas').resetView());
        await sleep(1000);

        // ── (c) pan with Space held (Mask mode's pan gesture), 3 x 3 s, one move per frame
        R.steps.pan = [];
        for (let rep = 0; rep < 3; rep++) {
            await win.keyboard.down('Space');
            R.steps.pan.push(await win.evaluate(async () => {
                const P = window.__perf; const { x, y, el } = P.center(); const c = document.querySelector('.mpi-canvas');
                const o0 = c.offsetX;
                el.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
                const st = await P.drive(3000, (i) => {
                    const dx = 80 * Math.sin(i / 10);
                    window.dispatchEvent(new MouseEvent('mousemove', { clientX: x + dx, clientY: y, bubbles: true }));
                });
                window.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
                return { ...st, offsetMoved: Math.round(Math.abs(c.offsetX - o0)) };
            }));
            await win.keyboard.up('Space');
            await sleep(500);
        }
        await win.evaluate(() => document.querySelector('.mpi-canvas').resetView());
        await sleep(1000);
        save();

        // ── (d) mask stroke, 3 x 3 s, one move per frame, a circle of r=120 screen px
        R.steps.stroke = [];
        for (let rep = 0; rep < 3; rep++) {
            R.steps.stroke.push(await win.evaluate(async () => {
                const P = window.__perf; const { x, y, el } = P.center(); const c = document.querySelector('.mpi-canvas');
                el.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: x + 120, clientY: y, bubbles: true, cancelable: true }));
                const st = await P.drive(3000, (i) => {
                    const a = i / 15;
                    window.dispatchEvent(new MouseEvent('mousemove', { clientX: x + 120 * Math.cos(a), clientY: y + 120 * Math.sin(a), bubbles: true }));
                });
                window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                return { ...st, canUndo: c.canUndoMask() };
            }));
            await sleep(500);
        }
        save();

        // ── (e) Mask -> Paint -> Prompt
        R.steps.switchToPaint = await timeSwitch('paint', 'paint');
        await sleep(1500);
        R.steps.switchToPrompt = await timeSwitch('prompt', 'prompt');
        await sleep(2000);
        R.steps.memBackToPrompt = await memSnapshot(app, 'Prompt (preview <img>, canvas destroyed)');
        // Prompt -> Mask: swapToCanvas remounts MpiCanvas and reloads the image
        R.steps.switchPromptToMask = await timeSwitch('maskBrush', 'mask');
        await sleep(2000);
        R.steps.memMask2 = await memSnapshot(app, 'Mask again after Prompt');
        save();
    } catch (e) {
        R.error = String(e && e.stack || e);
    } finally {
        R.consoleErrors = consoleErrors.slice(0, 40);
        R.pageErrors = pageErrors.slice(0, 20);
        R.nvsmiEnd = nvsmi();
        save();
        console.log(JSON.stringify(R, null, 1));
        console.log('RESULT', path.join(runDir, 'result.json'));
        await app.close().catch(() => {});
    }
})();
