// MPI-1142 follow-up: a landing crew member froze (Fabio: Reel, 2026-10-15) with nothing logged.
// Isolated app on the landing; every 500 ms, per crew member: the LIVE clip's state. A member
// whose live clip has not advanced for 7 s+ while its queue keeps swapping is frozen.
// The pointer sweeps across the crew (hover = interrupting greet) to stress the swaps.
// usage: node freeze.cjs <scratch dir> [seconds=180]
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47402';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const secs = Number(process.argv[3] || 180);
  const userData = path.join(process.argv[2], 'ud-freeze');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(process.argv[2], 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.waitForTimeout(4000);
    const cont = win.getByText('Continue', { exact: true });
    if (await cont.count()) await cont.first().click();
    await win.waitForTimeout(2000);
    const sample = () => win.evaluate(() => [...document.querySelectorAll('.mpi-landing__crew-member')].map(el => {
      const key = [...el.classList].find(c => c.startsWith('mpi-landing__crew-member--') && !/awake|vanished/.test(c)).split('--')[1];
      const live = el.querySelector('.mpi-landing__crew-clip--live:not(.mpi-landing__crew-fx)');
      const vids = [...el.querySelectorAll('video:not(.mpi-landing__crew-fx)')];
      const d = v => v && `${(v.getAttribute('src') || '-').replace(/^.*\//, '')} t=${v.currentTime.toFixed(2)} p=${+v.paused} e=${+v.ended} rs=${v.readyState} ns=${v.networkState}${v.error ? ' err=' + v.error.code : ''}`;
      return { key, t: live ? live.currentTime : -1, live: d(live), other: d(vids.find(v => v !== live)) };
    }));
    const last = {};
    const frozen = new Map();
    const t0 = Date.now();
    let worst = 0;
    const box = await win.locator('.mpi-landing__crew').boundingBox();
    for (let i = 0; i < secs * 2; i++) {
      if (box && i % 6 === 0) {   // sweep the pointer across the crew every 3 s
        const x = box.x + Math.random() * box.width;
        await win.mouse.move(x, box.y + box.height * 0.6, { steps: 4 });
      }
      await win.waitForTimeout(500);
      const now = Date.now();
      for (const m of await sample()) {
        const prev = last[m.key];
        if (!prev || m.t !== prev.t) { last[m.key] = { t: m.t, since: now }; frozen.delete(m.key); continue; }
        const stuck = now - prev.since;
        worst = Math.max(worst, stuck);
        if (stuck > 7000 && !frozen.has(m.key)) {
          frozen.set(m.key, true);
          console.log(`t=${((now - t0) / 1000).toFixed(0)}s FROZEN ${m.key} ${stuck}ms | live: ${m.live} | other: ${m.other}`);
        }
      }
    }
    console.log(`done ${secs}s, longest still clip ${worst} ms`);
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
