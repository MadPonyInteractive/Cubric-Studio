// MPI-1142 check: do video elements hold pool sockets, and do they let go after ~15 s?
// usage: node vidhold.cjs <scratch dir> <video url> [paused|play]
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
const PORT = '47396';
process.env.CUBRIC_PORT = PORT;
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

const established = () => execSync('netstat -ano').toString().split('\n')
  .filter(l => l.includes('ESTABLISHED') && l.split(/\s+/)[3] === `127.0.0.1:${PORT}`).length;
const VIDEO = process.argv[3];
const MODE = process.argv[4] || 'paused';

(async () => {
  const userData = path.join(process.argv[2], 'ud-vid');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const docs = path.join(userData, '..', 'docs-vid');
  fs.mkdirSync(docs, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: docs };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(6000);
    console.log('idle conns:', established());
    await win.evaluate(({ src, mode, n }) => {
      for (let i = 0; i < n; i++) {
        const v = document.createElement('video');
        v.muted = true; v.preload = 'auto'; v.loop = mode === 'play';
        v.src = src + '?v=' + i;
        v.style.cssText = mode === 'hidden' ? 'display:none'
          : 'position:fixed;width:80px;height:60px;top:0;left:' + i * 90 + 'px;z-index:99999';
        document.body.appendChild(v);
        if (mode === 'play') v.play().catch(() => {});
      }
    }, { src: VIDEO, mode: MODE, n: Number(process.env.N || 4) });
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      await win.waitForTimeout(2500);
      const img = await win.evaluate(async () => {
        const t = performance.now();
        const r = await Promise.race([
          new Promise(res => { const i = new Image(); i.onload = () => res('ok'); i.onerror = () => res('err'); i.src = '/assets/mascot/greet.png?b=' + Math.random(); }),
          new Promise(res => setTimeout(() => res('still waiting at 2s'), 2000)),
        ]);
        return `${r} ${Math.round(performance.now() - t)}ms`;
      });
      console.log(`t=${Math.round((Date.now() - t0) / 1000)}s conns=${established()} img=${img}`);
    }
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
