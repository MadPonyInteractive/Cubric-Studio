// MPI-1142: a [slow-load] line starts the net log once (routes/system.js -> main.js recordNetLogOnce).
// usage: node trigger.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47401';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-trigger');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const netlog = path.join(userData, 'logs', 'netlog.json');
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(3000);
    console.log('before slow-load: netlog exists =', fs.existsSync(netlog));
    const post = () => win.evaluate(() => fetch('/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'warn', category: 'slow-load', message: 'img 4000ms probe' }) }).then(r => r.status));
    console.log('post 1:', await post());
    await win.waitForTimeout(3000);
    console.log('post 2:', await post());
    await win.waitForTimeout(3000);
    console.log('after: netlog exists =', fs.existsSync(netlog), fs.existsSync(netlog) ? fs.statSync(netlog).size : 0, 'bytes');
  } finally {
    await app.close();
  }
  const lines = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => /\[netlog\]/.test(l));
  console.log(`${lines.length} [netlog] line(s):\n${lines.join('\n')}`);
})().catch((e) => { console.error(e); process.exit(1); });
