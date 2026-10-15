// MPI-1142: profile scrolling the Flow Library (isolated app). Frame gaps, long tasks and a CPU
// profile of the scroll window, top self-time functions printed.
// usage: node flowscroll.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47405';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-flowscroll');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.env.GPU) { delete env.CUBRIC_E2E; env.CUBRIC_BACKGROUND = '1'; } // GPU=1: hardware compositing like Fabio's app, still off-screen + own profile
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.setViewportSize({ width: 1600, height: 900 }).catch(() => {});
    await win.waitForTimeout(3000);
    await win.evaluate(async () => { const { Events } = await import('/js/events.js'); Events.emit('flows:open'); });
    await win.waitForSelector('.mpi-tile', { timeout: 30000 });
    await win.waitForTimeout(6000); // let the tiles load
    const info = await win.evaluate(() => ({ tiles: document.querySelectorAll('.mpi-tile').length, videos: document.querySelectorAll('.mpi-tile video').length,
      scroller: (() => { let n = document.querySelector('.mpi-tile'); while (n && !(n.scrollHeight > n.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(n).overflowY))) n = n.parentElement; return n ? n.className : null; })() }));
    console.log('tiles', info);
    await win.evaluate(() => {
      window.__gaps = []; window.__lt = []; let last = performance.now();
      const tick = (t) => { window.__gaps.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' });
    });
    const cdp = await win.context().newCDPSession(win);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
    const box = await win.locator('.mpi-tile').first().boundingBox();
    await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const t0 = Date.now();
    for (let i = 0; i < 40; i++) { await win.mouse.wheel(0, 120 * (i < 20 ? 1 : -1)); await win.waitForTimeout(50); }
    await win.waitForTimeout(1500);
    const wall = Date.now() - t0;
    const { profile } = await cdp.send('Profiler.stop');
    const r = await win.evaluate(() => { cancelAnimationFrame(window.__raf); const g = window.__gaps.slice(1).sort((a, b) => b - a);
      return { frames: g.length, worst: g.slice(0, 6).map(Math.round), over50: g.filter(x => x > 50).length, longtasks: window.__lt,
        playing: [...document.querySelectorAll('.mpi-tile video')].filter(v => !v.paused).length }; });
    console.log(`scroll ${wall} ms:`, JSON.stringify(r));
    const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
    const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame;
      const k = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-1)[0]}:${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
    console.log('top self time (ms):'); [...self].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${v.toFixed(0).padStart(6)}  ${k}`));
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
