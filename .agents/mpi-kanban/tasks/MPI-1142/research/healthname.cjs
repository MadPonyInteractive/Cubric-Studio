// MPI-1142: the [health] blocked-minute line names the script behind the long frames.
// Isolated app: three 1 s page tasks from a named function, then the next [health] line.
// usage: node healthname.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47419';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-healthname');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(3000);
    await win.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = 'function mpi1142Busy() { const t = performance.now(); while (performance.now() - t < 1000); }'
        + 'setTimeout(mpi1142Busy, 100); setTimeout(mpi1142Busy, 1500); setTimeout(mpi1142Busy, 3000);';
      document.head.appendChild(s);
    });
    await win.waitForTimeout(66000);
  } finally {
    await app.close();
  }
  const lines = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => /\[health\]/.test(l));
  console.log(lines.join('\n') || 'no [health] line');
})().catch((e) => { console.error(e); process.exit(1); });
