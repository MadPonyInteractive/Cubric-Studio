// MPI-1142: does a busy Electron MAIN process stall the renderer's image loads? Isolated app only.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47394';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(__dirname, 'ud-mainblock');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(__dirname, 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(3000);
    const load = (tag) => win.evaluate((tag) => new Promise((resolve) => {
      const t = performance.now();
      const img = new Image();
      const url = `/assets/mascot/happy.png?${tag}=${Date.now()}`;
      img.onload = img.onerror = () => {
        const e = performance.getEntriesByName(new URL(url, location.href).href).pop();
        resolve(`${tag}: ${Math.round(performance.now() - t)}ms` + (e ? ` queued ${Math.round(e.requestStart - e.startTime)} server ${Math.round(e.responseStart - e.requestStart)}` : ''));
      };
      img.src = url;
    }), tag);
    console.log(await load('baseline'));
    // Freeze main for 5 s, and start an image load 300 ms into the freeze.
    const block = app.evaluate(() => { const t = Date.now(); while (Date.now() - t < 5000) { /* busy */ } return 'unblocked'; });
    await new Promise(r => setTimeout(r, 300));
    console.log(await load('during-main-block'));
    console.log(await block);
    console.log(await load('after'));
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
