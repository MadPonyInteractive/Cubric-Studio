// MPI-1142: how long do gallery video cards hold their HTTP connections? Isolated app only.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47392';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');
const CLIP = path.join(__dirname, 'clip.mp4').replace(/\\/g, '/');
const N = Number(process.argv[2] || 8);
const WATCH_S = Number(process.argv[3] || 90);
const MODE = process.argv[4] || 'idle'; // idle | hover

(async () => {
  const userData = path.join(__dirname, 'ud-holds');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(6000);
    const cdp = await win.context().newCDPSession(win);
    await cdp.send('Network.enable');
    const open = new Map();
    const t0 = Date.now();
    cdp.on('Network.requestWillBeSent', (e) => { if (e.request.url.includes('clip.mp4')) open.set(e.requestId, { url: e.request.url, at: Date.now() }); });
    const done = (e) => open.delete(e.requestId);
    cdp.on('Network.loadingFinished', done);
    cdp.on('Network.loadingFailed', done);

    await win.evaluate(async ({ n, clip }) => {
      const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
      const host = document.createElement('div');
      host.id = 'holds-host';
      host.style.cssText = 'position:fixed;inset:0;width:1200px;height:900px;z-index:0;';
      document.body.appendChild(host);
      const groups = Array.from({ length: n }, (_, i) => ({
        id: `h-${i}`, type: 'video', selectedIndex: 0,
        history: [{ id: `h-item-${i}`, type: 'video',
          filePath: `/project-file?path=${encodeURIComponent(clip)}&v=${i}`,
          thumbPath: '/comfy_workflows/display/flow-scribble.webp' }],
      }));
      window.__holds = MpiGalleryGrid.mount(host, { groups });
    }, { n: N, clip: CLIP });

    if (MODE === 'hover') {
      await win.waitForTimeout(3000);
      const card = win.locator('#holds-host .mpi-group-card').first();
      await card.hover();
      await win.waitForTimeout(4000);
      await win.mouse.move(5, 5);
    }

    for (let s = 5; s <= WATCH_S; s += 5) {
      await win.waitForTimeout(5000);
      const vids = await win.evaluate(() => [...document.querySelectorAll('#holds-host video')].map(v => `${v.paused ? 'P' : 'PLAY'}/${v.readyState}/${v.networkState}`).join(' '));
      console.log(`t=${Math.round((Date.now() - t0) / 1000)}s open=${open.size} videos: ${vids}`);
    }
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
