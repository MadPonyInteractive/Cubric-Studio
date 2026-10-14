// MPI-1142 repro: fresh cache, open a copy of Qwen 2.1, then Flows; log in-flight loads per second.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
const PORT = '47393';
process.env.CUBRIC_PORT = PORT;
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');
const DOCS = path.join(__dirname, 'docs');
const PROJECT = path.join(DOCS, 'Cubric Studio', 'Projects', 'Qwen 2.1');

(async () => {
  const userData = path.join(__dirname, 'ud-repro');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: DOCS };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    const cdp = await win.context().newCDPSession(win);
    await cdp.send('Network.enable');
    const open = new Map();
    cdp.on('Network.requestWillBeSent', (e) => open.set(e.requestId, { type: e.type, url: e.request.url, at: Date.now() }));
    const done = (e) => open.delete(e.requestId);
    cdp.on('Network.loadingFinished', done);
    cdp.on('Network.loadingFailed', done);
    const t0 = Date.now();
    const snap = (label) => {
      const by = {};
      for (const r of open.values()) by[r.type] = (by[r.type] || 0) + 1;
      const old = [...open.values()].filter(r => Date.now() - r.at > 3000 && r.type !== 'EventSource')
        .map(r => `${r.type}:${decodeURIComponent(r.url.replace(/^.*?:\d+/, '')).slice(-60)}`);
      console.log(`t=${((Date.now() - t0) / 1000).toFixed(0)}s ${label} open=${JSON.stringify(by)}${old.length ? ' held>3s: ' + old.slice(0, 12).join(' , ') : ''}`);
    };
    for (let i = 0; i < 6; i++) { await win.waitForTimeout(1000); snap('landing'); }
    const r = await win.evaluate(async (folderPath) => (await fetch('/connector/open-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath }),
    })).json(), PROJECT);
    console.log('open-project', JSON.stringify(r).slice(0, 120));
    for (let i = 0; i < 4; i++) { await win.waitForTimeout(1000); snap('project'); }
    await win.evaluate(async () => { const { Events } = await import('/js/events.js'); Events.emit('flows:open'); });
    for (let i = 0; i < 30; i++) { await win.waitForTimeout(1000); snap('flows'); }
  } finally {
    await app.close();
  }
  const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => l.includes('slow-load'));
  console.log(`${log.length} slow-load lines`);
  console.log(log.slice(0, 15).map(l => l.slice(0, 200)).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
