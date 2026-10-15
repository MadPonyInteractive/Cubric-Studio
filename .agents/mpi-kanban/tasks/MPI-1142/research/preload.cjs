// MPI-1142: does a paused video with preload=metadata paint its first frame AND release its load,
// where preload=auto holds it ~15 s? usage: node preload.cjs <scratch dir> <auto|metadata> <abs video path>...
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47399';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const [dir, preload, ...files] = process.argv.slice(2);
  const userData = path.join(dir, 'ud-preload');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(dir, 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(4000);
    const cdp = await win.context().newCDPSession(win);
    await cdp.send('Network.enable');
    const open = new Map();
    cdp.on('Network.requestWillBeSent', (e) => { if (e.type === 'Media') open.set(e.requestId, Date.now()); });
    const done = (e) => open.delete(e.requestId);
    cdp.on('Network.loadingFinished', done);
    cdp.on('Network.loadingFailed', done);
    await win.evaluate(({ preload, files, seek }) => {
      window.__ready = 0;
      files.forEach((f, i) => {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = preload;
        v.addEventListener('loadeddata', () => { window.__ready++; if (seek) { try { v.currentTime = 0; } catch (_) {} } });
        v.style.cssText = `position:fixed;top:0;left:${i * 90}px;width:80px;height:60px;z-index:99999`;
        document.body.appendChild(v);
        v.src = '/project-file?path=' + encodeURIComponent(f);
      });
    }, { preload, files, seek: !!process.env.SEEK });
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) {
      await win.waitForTimeout(2000);
      const ready = await win.evaluate(() => window.__ready);
      const ages = [...open.values()].map(t => Math.round((Date.now() - t) / 1000));
      console.log(`t=${Math.round((Date.now() - t0) / 1000)}s preload=${preload} seek=${!!process.env.SEEK} firstFrame=${ready}/${files.length} mediaInFlight=${ages.length} ages=${ages.join(',')}`);
    }
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
