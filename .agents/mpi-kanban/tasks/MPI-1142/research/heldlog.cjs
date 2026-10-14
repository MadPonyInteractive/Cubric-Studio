// MPI-1142 check: a picture queued behind held connections logs [slow-load] ... | held: <the holders>.
// usage: node heldlog.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47397';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-held');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const docs = path.join(userData, '..', 'docs-held');
  fs.mkdirSync(docs, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: docs };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(6000);
    const r = await win.evaluate(async () => {
      const es = [1, 2, 3, 4].map(() => new EventSource('/connector/jobs/stream?probe=1'));
      await new Promise(r => setTimeout(r, 1500));
      const t0 = performance.now();
      const img = new Promise(res => { const i = new Image(); i.onload = () => res('loaded'); i.onerror = () => res('error'); i.src = '/assets/mascot/greet.png?b=' + Math.random(); });
      setTimeout(() => es.forEach(e => e.close()), 12000);
      const out = await img;
      return `${out} after ${Math.round(performance.now() - t0)} ms`;
    });
    console.log('image', r);
    await win.waitForTimeout(3000);
  } finally {
    await app.close();
  }
  const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => l.includes('slow-load') || l.includes('held-load'));
  console.log(log.join('\n') || 'no slow-load line');
})().catch((e) => { console.error(e); process.exit(1); });
