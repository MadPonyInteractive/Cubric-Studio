// MPI-1142: which change makes a whole-page style recalc? Isolated app, video project, Cosmo panel open.
// Each experiment runs 60 frames of one change and counts UpdateLayoutTree events touching >4000 elements.
// usage: node recalc.cjs <scratch dir> <project name>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47415';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

const EXPERIMENTS = {
  // the drag's own write, no pointer
  var: (i) => { const a = document.querySelector('.main-area'); a.style.setProperty('--agent-panel-w', `${400 + (i % 2) * 40}px`); },
  // the workspace width alone, no custom property
  margin: (i) => { document.getElementById('workspace-content').style.marginLeft = `${400 + (i % 2) * 40}px`; },
  // a class on the panel (what the drag start/end toggles)
  klass: (i) => { document.getElementById('agent-panel-mount').classList.toggle('mpi1142-probe', i % 2 === 0); },
  // the gallery's own re-render, width unchanged
  render: () => { window.dispatchEvent(new Event('mpi1142-render')); },
};

(async () => {
  const SCR = process.argv[2];
  const PROJECT = path.join(SCR, 'docs', 'Cubric Studio', 'Projects', process.argv[3]);
  const userData = path.join(SCR, 'ud-recalc');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(SCR, 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
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
    const cdp = await win.context().newCDPSession(win);
    for (const [name, fn] of Object.entries(EXPERIMENTS)) {
      if (process.argv[4] && !process.argv[4].split(',').includes(name)) continue;
      const events = [];
      const onData = (d) => events.push(...d.value);
      cdp.on('Tracing.dataCollected', onData);
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking', transferMode: 'ReportEvents' });
      await win.evaluate(async (src) => {
        const f = eval(src); // eslint-disable-line no-eval
        for (let i = 0; i < 60; i++) { f(i); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); }
      }, `(${fn.toString()})`);
      await win.waitForTimeout(500);
      const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
      await cdp.send('Tracing.end'); await done;
      cdp.off('Tracing.dataCollected', onData);
      const main = events.find(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
      const ult = events.filter(e => main && e.tid === main.tid && e.ph === 'X' && e.name === 'UpdateLayoutTree');
      const big = ult.filter(e => (e.args?.elementCount || 0) > 4000);
      const fns = events.filter(e => main && e.tid === main.tid && e.ph === 'X' && e.name === 'FunctionCall' && e.dur > 20000);
      const inv = new Map(); for (const e of events) if (/InvalidationTracking/.test(e.name)) { const d = e.args?.data || {}; const k = `${e.name.replace('InvalidationTracking','')} ${d.reason || d.changedClass || d.changedAttribute || d.changedPseudo || d.changedId || ''} ${(d.nodeName || '').slice(0, 60)}`; inv.set(k, (inv.get(k) || 0) + 1); }
      for (const b of big) {
        const prev = ult.filter(e => e.ts < b.ts).pop();
        const from = prev ? prev.ts + prev.dur : b.ts - 50000;
        const win2 = new Map();
        for (const e of events) if (/InvalidationTracking/.test(e.name) && e.ts >= from && e.ts <= b.ts + b.dur) { const d = e.args?.data || {}; const k = `${e.name.replace('InvalidationTracking','')} ${d.reason || ''} ${d.changedClass || d.changedAttribute || d.changedPseudo || d.changedId || ''} ${(d.nodeName || '').slice(0, 50)}${d.invalidationSet ? ' set=' + JSON.stringify(d.invalidationSet).slice(0, 80) : ''}${d.selectors ? ' sel=' + JSON.stringify(d.selectors).slice(0, 120) : ''}`; win2.set(k, (win2.get(k) || 0) + 1); }
        console.log(`  full recalc ${Math.round(b.dur / 1000)}ms ${b.args?.elementCount} el, invalidations before it:`, [...win2].sort((a, c) => c[1] - a[1]).slice(0, 10).map(([k, v]) => `${v}x ${k}`).join(' | '));
      }
      console.log('  invalidations:', [...inv].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v}x ${k}`).join(' | '));
      console.log(`${name.padEnd(7)} recalcs ${ult.length}, full ${big.length} (${Math.round(big.reduce((a, e) => a + e.dur, 0) / 1000)} ms), max elements ${Math.max(0, ...ult.map(e => e.args?.elementCount || 0))}; scripts >20ms: ${fns.map(e => `${(e.args?.data?.url || '').split('/').pop()}:${e.args?.data?.lineNumber} ${Math.round(e.dur / 1000)}ms`).slice(0, 4).join(', ')}`);
    }
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
