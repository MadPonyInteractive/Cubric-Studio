// MPI-1142 check: does the 6-per-host HTTP/1.1 socket pool starve image loads?
// Opens K extra EventSources (each holds one connection, like the app's own 3), then times one image load.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
const PORT = '47395';
process.env.CUBRIC_PORT = PORT;
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

const established = () => execSync('netstat -ano').toString().split('\n')
  .filter(l => l.includes('ESTABLISHED') && l.split(/\s+/)[3] === `127.0.0.1:${PORT}`).length;

(async () => {
  const userData = path.join(process.argv[2], 'ud-pool');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const docs = path.join(userData, '..', 'docs-pool');
  fs.mkdirSync(docs, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: docs };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(6000);
    console.log('idle app -> connections held to server:', established());
    for (const k of [0, 1, 2, 3, 4]) {
      const r = await win.evaluate(async (k) => {
        window.__es = window.__es || [];
        while (window.__es.length < k) window.__es.push(new EventSource('/connector/jobs/stream'));
        await new Promise(r => setTimeout(r, 1500));
        const t0 = performance.now();
        const ok = await Promise.race([
          new Promise(res => { const i = new Image(); i.onload = () => res('loaded'); i.onerror = () => res('error'); i.src = '/assets/mascot/greet.png?b=' + Math.random(); }),
          new Promise(res => setTimeout(() => res('still waiting'), 8000)),
        ]);
        return `${ok} after ${Math.round(performance.now() - t0)} ms`;
      }, k);
      console.log(`extra EventSources=${k} conns=${established()} -> image ${r}`);
    }
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
