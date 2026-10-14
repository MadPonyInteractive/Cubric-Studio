// MPI-1142 check: with --disable-http-cache, pictures still load and no HTTP disk cache is written.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47394';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

const du = (dir) => {
  if (!fs.existsSync(dir)) return { files: 0, bytes: 0 };
  let files = 0, bytes = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) { files++; bytes += fs.statSync(path.join(e.parentPath || e.path, e.name)).size; }
  }
  return { files, bytes };
};

(async () => {
  const userData = path.join(process.argv[2] || __dirname, 'ud-nocache');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const docs = path.join(userData, '..', 'docs-nocache');
  fs.mkdirSync(docs, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: docs };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  let imgs;
  try {
    const win = await shellWindow(app, 60000);
    const switchOn = await app.evaluate(({ app: a }) => a.commandLine.hasSwitch('disable-http-cache'));
    console.log('disable-http-cache switch:', switchOn);
    await win.waitForTimeout(4000);
    await win.evaluate(async () => { const { Events } = await import('/js/events.js'); Events.emit('flows:open'); });
    await win.waitForTimeout(8000);
    imgs = await win.evaluate(() => {
      const all = [...document.images].filter(i => i.currentSrc);
      return { total: all.length, loaded: all.filter(i => i.complete && i.naturalWidth > 0).length };
    });
    console.log('images on screen:', JSON.stringify(imgs));
  } finally {
    await app.close();
  }
  console.log('Cache folder:', JSON.stringify(du(path.join(userData, 'Cache'))));
  const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => l.includes('slow-load'));
  console.log(`${log.length} slow-load lines`);
})().catch((e) => { console.error(e); process.exit(1); });
