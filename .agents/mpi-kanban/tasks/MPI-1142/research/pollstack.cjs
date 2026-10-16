// MPI-1142: the memory monitor must not stack stats polls on a slow answer.
// Isolated app; /system/stats is made to hang 10 s via route interception; count requests in 9 s.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47423';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-poll');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(4000);
    let n = 0;
    await win.route('**/system/stats', async (route) => { n++; await new Promise(r => setTimeout(r, 10000)); await route.continue().catch(() => {}); });
    await win.waitForTimeout(9000);
    console.log(`/system/stats requests sent in 9 s while each hangs 10 s: ${n}`);
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
