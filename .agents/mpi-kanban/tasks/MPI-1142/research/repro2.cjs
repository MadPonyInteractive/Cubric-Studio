// MPI-1142 repro: landing -> open a copy of Qwen 2.1 -> back to landing -> Flows, on an isolated app.
// Every 2 s: holders (response in, load not finished, 3 s+) and victims (no response yet, 3 s+), via CDP.
// usage: node repro2.cjs <scratch dir holding docs/Cubric Studio/Projects/Qwen 2.1>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47398';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const DOCS = path.join(process.argv[2], 'docs');
  const PROJECT = path.join(DOCS, 'Cubric Studio', 'Projects', 'Qwen 2.1');
  const userData = path.join(process.argv[2], 'ud-repro2');
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
    cdp.on('Network.requestWillBeSent', (e) => open.set(e.requestId, { type: e.type, url: e.request.url, prio: e.request.initialPriority, at: Date.now() }));
    cdp.on('Network.responseReceived', (e) => { const r = open.get(e.requestId); if (r) r.resp = Date.now(); });
    const done = (e) => open.delete(e.requestId);
    cdp.on('Network.loadingFinished', done);
    cdp.on('Network.loadingFailed', done);
    const t0 = Date.now();
    const short = (u) => decodeURIComponent(u.replace(/^.*?:\d+/, '')).replace(/^.*[\\/]/, '').slice(0, 50);
    const snap = (label) => {
      const now = Date.now();
      const old = [...open.values()].filter(r => now - r.at > 3000 && r.type !== 'EventSource');
      const holders = old.filter(r => r.resp).map(r => `${r.type}/${r.prio}:${short(r.url)} ${Math.round((now - r.at) / 1000)}s`);
      const victims = old.filter(r => !r.resp).length;
      console.log(`t=${((now - t0) / 1000).toFixed(0)}s ${label} holders=${holders.length} victims=${victims}${holders.length ? ' | ' + holders.join(', ') : ''}`);
    };
    const phase = async (label, secs) => { for (let i = 0; i < secs / 2; i++) { await win.waitForTimeout(2000); snap(label); } };
    await phase('landing', 8);
    await win.evaluate(async (folderPath) => (await fetch('/connector/open-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath }),
    })).json(), PROJECT);
    await phase('project', 20);
    await win.evaluate(async () => { const { navigate, PAGE_LANDING } = await import('/js/router.js'); navigate(PAGE_LANDING); });
    await phase('back-to-landing', 30);
    await win.evaluate(async () => { const { Events } = await import('/js/events.js'); Events.emit('flows:open'); });
    await phase('flows', 20);
  } finally {
    await app.close();
  }
  const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => /slow-load|held-load/.test(l));
  console.log(`${log.length} slow/held lines`);
  console.log(log.slice(0, 25).map(l => l.slice(0, 230)).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
