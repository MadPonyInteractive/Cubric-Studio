// Live check for MPI-1137: throttle an ISOLATED app, load an img + video, read its app.log.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47391';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(__dirname, 'ud-slowload');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    console.log('shell up');
    const cdp = await win.context().newCDPSession(win);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 3500, downloadThroughput: -1, uploadThroughput: -1 });
    const types = await win.evaluate(() => new Promise((resolve) => {
      const img = new Image();
      img.src = '/assets/mascot/happy.png?t=' + Date.now();
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto';
      v.src = '/comfy_workflows/display/flow-character-sheet-editor.mp4?t=' + Date.now();
      document.body.appendChild(v);
      setTimeout(() => resolve(['TIMEOUT', ...performance.getEntriesByType('resource').filter(e => /happy|sheet-editor/.test(e.name)).map(e => e.initiatorType + ' ' + Math.round(e.duration))]), 25000);
      let n = 0;
      const done = () => { if (++n === 2) setTimeout(() => resolve(performance.getEntriesByType('resource').filter(e => /happy|sheet-editor/.test(e.name)).map(e => `${e.initiatorType} ${Math.round(e.duration)}`)), 500); };
      img.onload = img.onerror = done;
      v.onloadeddata = v.onerror = done;
    }));
    console.log('resource entries:', types);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await new Promise(r => setTimeout(r, 1500));
  } finally {
    await app.close();
  }
  const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8');
  console.log(log.split('\n').filter(l => l.includes('slow-load')).join('\n') || 'NO slow-load lines');
})().catch((e) => { console.error(e); process.exit(1); });
