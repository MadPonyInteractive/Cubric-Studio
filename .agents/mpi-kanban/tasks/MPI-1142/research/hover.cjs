// MPI-1142: a gallery video card plays ONCE on hover then shows frame 0, and a fast fly-over leaves nothing playing.
// usage: node hover.cjs <scratch dir holding docs/Cubric Studio/Projects/Qwen 2.1>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47401';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const DOCS = path.join(process.argv[2], 'docs');
  const PROJECT = path.join(DOCS, 'Cubric Studio', 'Projects', 'Qwen 2.1');
  const userData = path.join(process.argv[2], 'ud-hover');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: DOCS };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  let failed = false;
  const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) failed = true; };
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(3000);
    await win.evaluate(async (folderPath) => (await fetch('/connector/open-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath }),
    })).json(), PROJECT);
    await win.waitForTimeout(8000);
    const card = win.locator('.mpi-group-card:has(video.mpi-group-card__thumb--hover-video-ready)').first();
    const state = () => card.locator('video.mpi-group-card__thumb--hover-video').evaluate(v => ({
      paused: v.paused, t: +v.currentTime.toFixed(2), d: +v.duration.toFixed(2), loop: v.loop,
    }));
    await card.locator('video.mpi-group-card__thumb--hover-video').evaluate(v => { window.__plays = 0; v.addEventListener('play', () => window.__plays++); });
    await card.hover();
    await win.waitForTimeout(1500);
    const mid = await state();
    check(!mid.paused && mid.t > 0 && !mid.loop, `hover plays, no loop ${JSON.stringify(mid)}`);
    await win.waitForTimeout((mid.d - mid.t + 2) * 1000);
    const end = await state();
    check(end.paused && end.t === 0, `played once, back on frame 0 while still hovered ${JSON.stringify(end)}`);
    check(await win.evaluate(() => window.__plays) === 1, 'exactly one play');
    await win.mouse.move(5, 5);
    // A late play (data landing, scroll settling) after the pointer already left must not start the clip.
    await card.evaluate(c => c._hoverPlay());
    await win.waitForTimeout(1000);
    const late = await state();
    check(late.paused, `a late play with the pointer off the card does nothing ${JSON.stringify(late)}`);
  } finally {
    await app.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
