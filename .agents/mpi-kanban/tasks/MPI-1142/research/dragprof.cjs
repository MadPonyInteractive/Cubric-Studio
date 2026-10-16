// MPI-1142: profile dragging the Cosmo panel handle with a video-heavy project open (isolated app).
// Frame gaps, long tasks, and the DevTools trace split (style recalc element counts, layout, script).
// usage: node dragprof.cjs <scratch dir holding docs/Cubric Studio/Projects/<project>> <project name>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47413';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const SCR = process.argv[2];
  const PROJECT = path.join(SCR, 'docs', 'Cubric Studio', 'Projects', process.argv[3]);
  const userData = path.join(SCR, 'ud-dragprof');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(SCR, 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.env.GPU) { delete env.CUBRIC_E2E; env.CUBRIC_BACKGROUND = '1'; }
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.setViewportSize({ width: 1600, height: 900 }).catch(() => {});
    await win.waitForTimeout(4000);
    await win.evaluate(async (folderPath) => (await fetch('/connector/open-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath }),
    })).json(), PROJECT);
    await win.waitForTimeout(12000);
    await win.evaluate(async () => { const { state } = await import('/js/state.js'); state.agentMode = true; });
    await win.waitForTimeout(3000);
    const h = await win.locator('#agent-panel-mount .mpi-resize-handle').boundingBox();
    console.log('handle', JSON.stringify(h), await win.evaluate(() => ({ el: document.getElementsByTagName('*').length, v: document.getElementsByTagName('video').length })));
    await win.evaluate(() => {
      window.__gaps = []; window.__lt = []; let last = performance.now();
      const tick = (t) => { window.__gaps.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' });
    });
    const cdp = await win.context().newCDPSession(win);
    const events = [];
    cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
    const x0 = h.x + h.width / 2, y = h.y + h.height / 2;
    await win.mouse.move(x0, y); await win.mouse.down();
    const t0 = Date.now();
    for (let i = 0; i < 120; i++) { await win.mouse.move(x0 + 200 * Math.sin(i / 120 * Math.PI * 2), y); await win.waitForTimeout(16); }
    await win.mouse.up();
    const wall = Date.now() - t0;
    await win.waitForTimeout(1000);
    const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.end'); await done;
    const r = await win.evaluate(() => { cancelAnimationFrame(window.__raf); const g = window.__gaps.slice(1).sort((a, b) => b - a);
      return { frames: g.length, worst: g.slice(0, 6).map(Math.round), over50: g.filter(x => x > 50).length, longtasks: window.__lt }; });
    console.log(`drag ${wall} ms:`, JSON.stringify(r));
    const main = events.find(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
    const mine = events.filter(e => main && e.tid === main.tid && e.ph === 'X' && e.dur);
    const tot = new Map(); for (const e of mine) tot.set(e.name, (tot.get(e.name) || 0) + e.dur / 1000);
    console.log('trace main-thread ms:', [...tot].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v.toFixed(0)}`).join(' '));
    const ult = mine.filter(e => e.name === 'UpdateLayoutTree');
    const ec = ult.map(e => e.args?.elementCount || 0).sort((a, b) => b - a);
    console.log(`UpdateLayoutTree x${ult.length}, elements per recalc top: ${ec.slice(0, 5).join(',')} median ${ec[Math.floor(ec.length / 2)]}, worst ${Math.round(Math.max(0, ...ult.map(e => e.dur)) / 1000)} ms`);
    const bigR = ult.filter(e => (e.args?.elementCount || 0) > 4000);
    console.log(`full recalcs: ${bigR.length}, ${Math.round(bigR.reduce((a, e) => a + e.dur, 0) / 1000)} ms; forced from:`, JSON.stringify([...bigR.reduce((m, e) => { const st = e.args?.beginData?.stackTrace?.[0]; const k = st ? `${st.functionName} ${st.url.split('/').pop()}:${st.lineNumber}` : 'frame'; m.set(k, (m.get(k) || 0) + 1); return m; }, new Map())]));
    const lay = mine.filter(e => e.name === 'Layout');
    console.log(`Layout x${lay.length}, worst ${Math.round(Math.max(0, ...lay.map(e => e.dur)) / 1000)} ms, dirty/total top: ${lay.sort((a, b) => b.dur - a.dur).slice(0, 3).map(e => `${e.args?.beginData?.dirtyObjects}/${e.args?.beginData?.totalObjects}`).join(' ')}`);
    const fn = mine.filter(e => /FunctionCall|TimerFire|EventDispatch/.test(e.name) && e.dur > 8000);
    console.log('script >8ms:', fn.slice(0, 10).map(e => `${e.name} ${Math.round(e.dur / 1000)}ms ${e.args?.data?.functionName || e.args?.data?.type || ''} ${(e.args?.data?.url || '').split('/').pop()}:${e.args?.data?.lineNumber || ''}`).join(' | '));
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
