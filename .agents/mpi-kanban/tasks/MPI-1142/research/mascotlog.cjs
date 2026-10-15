// MPI-1142: a crew member whose swap never lands must leave a [mascot] line (heroCrew.js _paintClip).
// Isolated app: after the crew is up, Reel's greet/happy clips first HANG (never answered), then
// FAIL (aborted); a hover on Reel requests a greet each time. Expect one `not on screen` line and
// one `would not play` line for video.
// usage: node mascotlog.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47403';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const userData = path.join(process.argv[2], 'ud-mascotlog');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    // From the start, so no warm load caches them: happy never answers, greet fails, and
    // while `hangAll` every other Reel clip is held too (a sustained stall = a real freeze).
    let hangAll = false;
    const held = [];
    await win.route(/assets\/mascot\/video\/(idle|transition)-[\w-]+\.webm/, (route) => (hangAll ? held.push(route) : route.continue()));
    await win.route(/assets\/mascot\/video\/happy-\d\.webm/, () => {});
    await win.route(/assets\/mascot\/video\/greet-\d\.webm/, (route) => route.abort());
    await win.waitForTimeout(4000);
    const cont = win.getByText('Continue', { exact: true });
    if (await cont.count()) await cont.first().click();
    for (let i = 0; i < 3; i++) await win.keyboard.press('Escape');   // the What's-new dialog
    await win.waitForTimeout(3000);
    const reel = win.locator('.mpi-landing__crew-member--video');
    await reel.dispatchEvent('click');          // happy: hangs
    await win.waitForTimeout(10000);
    await reel.dispatchEvent('pointerenter');   // greet: fails
    await win.waitForTimeout(4000);
    await reel.dispatchEvent('pointerleave');
    await win.evaluate(() => performance.clearResourceTimings());
    hangAll = true;                             // every Reel clip stalls: expect `frozen`
    await win.waitForTimeout(15000);
    hangAll = false;
    held.splice(0).forEach(r => r.continue().catch(() => {}));
    await win.waitForTimeout(8000);             // expect `moving again`
  } finally {
    await app.close();
  }
  const lines = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => /\[mascot\]/.test(l));
  console.log(`${lines.length} [mascot] line(s):\n${lines.map(l => l.slice(0, 260)).join('\n')}`);
})().catch((e) => { console.error(e); process.exit(1); });
