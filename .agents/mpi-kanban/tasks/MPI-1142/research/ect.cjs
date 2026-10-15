// MPI-1142: the app pins Chromium's network-quality estimate to 4G (main.js), and the [health] log runs.
// usage: node ect.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47403';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-ect');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    console.log('effectiveType =', await win.evaluate(() => navigator.connection.effectiveType));
    // a main-thread block over 2 s must show in the next per-minute [health] warn
    // (a page task, not the CDP evaluate itself, which the longtask observer does not see)
    await win.evaluate(() => setTimeout(() => { const t = Date.now(); while (Date.now() - t < 2500); }, 0));
    await win.waitForTimeout(65000);
  } finally {
    await app.close();
  }
  const lines = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => /\[health\]/.test(l));
  console.log(`${lines.length} [health] line(s):\n${lines.join('\n')}`);
})().catch((e) => { console.error(e); process.exit(1); });
