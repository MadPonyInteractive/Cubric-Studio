// MPI-1142: a hidden window must not read as a frozen crew when it comes back (heroCrew.js).
// Isolated app on the landing: hide the window 30 s, show it, wait 12 s. Expect 0 [mascot] lines.
// usage: node hide.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47405';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-hide');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(6000);
    const vis = () => win.evaluate(() => document.visibilityState);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.hide()));
    await win.waitForTimeout(2000);
    console.log('hidden:', await vis());
    await win.waitForTimeout(28000);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.show()));
    await win.waitForTimeout(12000);
    console.log('shown:', await vis());
  } finally {
    await app.close();
  }
  const lines = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => /\[mascot\]/.test(l));
  console.log(`${lines.length} [mascot] line(s)${lines.length ? ':\n' + lines.map(l => l.slice(0, 200)).join('\n') : ''}`);
})().catch((e) => { console.error(e); process.exit(1); });
