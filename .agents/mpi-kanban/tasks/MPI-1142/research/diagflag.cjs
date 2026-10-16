// MPI-1142 check: the speed diagnostics stay silent by default and come back with CUBRIC_SPEED_DIAG=1.
// Isolated app only (own port + profile). usage: node diagflag.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47398';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

async function run(label, diag) {
  const userData = path.join(process.argv[2], `ud-diag-${label}`);
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const docs = path.join(process.argv[2], `docs-diag-${label}`);
  fs.mkdirSync(docs, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: docs };
  if (diag) env.CUBRIC_SPEED_DIAG = '1'; else delete env.CUBRIC_SPEED_DIAG;
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(15000);   // /events/stream is open 10 s+ -> one [held-load] when on
    const flag = await win.evaluate(async () => (await import('/dev_configs/app_config.js')).APP_CONFIG.speed_diagnostics);
    const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8');
    const count = (tag) => (log.match(new RegExp(`\\[${tag}\\]`, 'g')) || []).length;
    console.log(`${label}: renderer flag=${flag}, [held-load]=${count('held-load')}, [slow-load]=${count('slow-load')}, [health]=${count('health')}`);
  } finally {
    await app.close();
  }
}

(async () => {
  await run('off', false);
  await run('on', true);
})();
