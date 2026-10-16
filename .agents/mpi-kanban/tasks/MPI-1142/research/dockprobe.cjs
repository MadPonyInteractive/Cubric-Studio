// MPI-1142: the Flow result dock still widens to 260px for an audio result (class, not :has(audio)).
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47421';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-dock');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(3000);
    console.log(JSON.stringify(await win.evaluate(async () => {
      const { MpiFlowResultDock } = await import('/js/components/Compounds/MpiFlowResultDock/MpiFlowResultDock.js');
      const host = document.createElement('div'); document.body.appendChild(host);
      const dock = MpiFlowResultDock.mount(host, {});
      dock.el.setOpen(true);
      await new Promise(r => setTimeout(r, 500)); // component css
      const media = dock.el.querySelector('.mpi-flow-result-dock__media');
      const wrap = document.createElement('div'); wrap.appendChild(document.createElement('audio'));
      dock.el.setContent(wrap);
      const audio = { cls: media.className, width: getComputedStyle(media).width, child: getComputedStyle(wrap).width };
      dock.el.setContent(document.createElement('img'));
      const img = { cls: media.className, width: getComputedStyle(media).width };
      dock.el.setContent(null);
      return { audio, img, empty: media.className };
    })));
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
