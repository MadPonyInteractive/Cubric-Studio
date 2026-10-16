// MPI-1142: per-second long tasks during a generation. Isolated app, copied video-heavy project.
// Phase A: 30 s idle in the project. Phase B: 30 s with the status bar clock running (tool:running +
// tool:accepted, as a real generation emits). Long tasks + CPU profile + DevTools trace per phase.
// usage: node genlag.cjs <scratch dir holding docs/Cubric Studio/Projects/<project>> <project name>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47411';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const SCR = process.argv[2];
  const PROJECT = path.join(SCR, 'docs', 'Cubric Studio', 'Projects', process.argv[3]);
  const userData = path.join(SCR, 'ud-genlag');
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
    console.log('open:', JSON.stringify(await win.evaluate(async (folderPath) => (await fetch('/connector/open-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath }),
    })).json(), PROJECT)).slice(0, 200));
    await win.waitForTimeout(15000);
    if (process.env.OLDHAS) await win.evaluate(() => { const st = document.createElement('style'); st.textContent = '.mpi1142-probe:has(audio) > * { width: 100%; }'; document.head.appendChild(st); });
    console.log('old :has(audio) rule injected:', !!process.env.OLDHAS);
    await win.evaluate(() => {
      window.__lt = []; window.__mut = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' });
      new MutationObserver(m => { window.__mut += m.length; }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    const cdp = await win.context().newCDPSession(win);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });

    const phase = async (label, secs) => {
      await win.evaluate(() => { window.__lt.length = 0; window.__mut = 0; });
      const events = [];
      cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
      await cdp.send('Profiler.start');
      await win.waitForTimeout(secs * 1000);
      const { profile } = await cdp.send('Profiler.stop');
      const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
      await cdp.send('Tracing.end'); await done;
      const dom = await win.evaluate(() => ({ lt: window.__lt.slice(), mut: window.__mut,
        elements: document.getElementsByTagName('*').length, videos: document.getElementsByTagName('video').length }));
      const lt = dom.lt;
      console.log(`\n== ${label} ${secs}s: ${lt.length} long tasks, ${lt.reduce((a, b) => a + b, 0)} ms, worst ${Math.max(0, ...lt)} | mutations ${dom.mut} | ${dom.elements} elements, ${dom.videos} videos`);
      // trace: total ms per top-level event name on the renderer main thread
      const main = events.find(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
      const tot = new Map();
      for (const e of events) if (main && e.tid === main.tid && e.ph === 'X' && e.dur) tot.set(e.name, (tot.get(e.name) || 0) + e.dur / 1000);
      const full = events.filter(e => main && e.tid === main.tid && e.name === 'UpdateLayoutTree' && (e.args?.elementCount || 0) > 4000);
      console.log(`full-page restyles: ${full.length}, ${Math.round(full.reduce((a, e) => a + e.dur, 0) / 1000)} ms`);
      console.log('trace main-thread ms:', [...tot].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v.toFixed(0)}`).join(' '));
      const big = events.filter(e => main && e.tid === main.tid && e.ph === 'X' && e.dur > 30000 && /Layout|UpdateLayoutTree|Paint|RunTask|FunctionCall|TimerFire|EventDispatch/.test(e.name));
      console.log('events >30ms:', big.slice(0, 15).map(e => `${e.name} ${Math.round(e.dur / 1000)}ms${e.args?.beginData?.dirtyObjects ? ' dirty=' + e.args.beginData.dirtyObjects + '/' + e.args.beginData.totalObjects : ''}${e.args?.data?.functionName ? ' ' + e.args.data.functionName + ' ' + (e.args.data.url || '').split('/').pop() + ':' + e.args.data.lineNumber : ''}`).join(' | '));
      const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
      profile.samples.forEach((id, i) => { const f = byId.get(id).callFrame;
        const k = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-1)[0]}:${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000); });
      console.log('top self (ms):', [...self].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${v.toFixed(0)} ${k}`).join(' | '));
      cdp.removeAllListeners('Tracing.dataCollected');
    };

    await phase('idle in project', 20);
    await win.evaluate(async () => { const { Events } = await import('/js/events.js');
      Events.emit('tool:running', { tool: 'groupHistory', id: 'fake1', type: 'i2v' });
      Events.emit('tool:accepted', { tool: 'groupHistory', id: 'fake1' }); });
    await phase('status-bar clock running', 20);
    await win.evaluate(async () => {
      const { activeGenerations } = await import('/js/services/activeGenerations.js');
      const tempId = 'tmp-fake1';
      const g = activeGenerations.start({ id: 'fake1', scope: 'gallery', tempId, operation: 'i2v', modelId: 'h3',
        placeholderGroup: { id: tempId, type: 'video', name: 'Generating...', history: [], selectedIndex: 0, width: 1280, height: 720, isGenerating: true } });
      activeGenerations.setPromptId(g.id, 'p-fake1');
    });
    await phase('placeholder card (generating mascot)', 20);
    console.log('placeholder mounted:', await win.evaluate(() => !!document.querySelector('.mpi-group-card--mascot-idle, .mpi-group-card--mascot-cooking')));
    await win.evaluate(async () => {
      const { activeGenerations } = await import('/js/services/activeGenerations.js');
      const { Events } = await import('/js/events.js');
      activeGenerations.resetPreview('fake1', { rate: 24, length: 56 });
      const blob = await (await fetch('/comfy_workflows/display/flow-scribble.webp')).blob();
      for (let i = 0; i < 56; i++) Events.emit('preview:frame', { engine: 'local', promptId: 'p-fake1', seq: i, url: URL.createObjectURL(blob) });
    });
    await phase('placeholder + looping clip preview', 20);
    await win.screenshot({ path: path.join(SCR, 'genlag.png') });
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
