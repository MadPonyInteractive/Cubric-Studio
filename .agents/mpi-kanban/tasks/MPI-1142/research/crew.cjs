// MPI-1142 repro 2: the landing alone (no project opened) on an isolated app with ~24 projects.
// Reports every picture/video whose Resource Timing queue (requestStart - startTime) passed 3 s,
// and the app's own [slow-load] lines. Run before and after a fix; the landing crew's warm
// clips (heroCrew.js _warm) are the suspect.
// usage: node crew.cjs <scratch dir holding docs/Cubric Studio/Projects/*>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47399';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const DOCS = path.join(process.argv[2], 'docs');
  const userData = path.join(process.argv[2], 'ud-crew');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: DOCS };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    // A live engine adds two permanent streams (/comfy/events/stream, /comfy/downloads/stream)
    // that the E2E profile never opens. Stand-ins, opened before the project list lands.
    const extra = Number(process.argv[3] || 0);
    await win.evaluate((n) => { for (let i = 0; i < n; i++) new EventSource(`/connector/jobs/stream?probe=${i}`); }, extra);
    console.log(`extra streams: ${extra}`);
    const queued = () => win.evaluate(() => performance.getEntriesByType('resource')
      .filter(e => /^(img|video|audio)$/.test(e.initiatorType) || /\.(webm|mp4|webp|png|jpg)/.test(e.name))
      .map(e => ({ q: e.requestStart ? e.requestStart - e.startTime : -1, n: decodeURIComponent(e.name).replace(/^.*[\\/]/, '').slice(0, 40) })));
    await win.waitForTimeout(25000);
    await win.screenshot({ path: path.join(process.argv[2], 'crew-landing.png') });
    console.log('dom:', await win.evaluate(() => ({
      videos: document.querySelectorAll('video').length,
      crew: document.querySelectorAll('.mpi-landing__crew-member').length,
      imgs: [...document.images].filter(i => i.complete && i.naturalWidth).length,
    })));
    const landing = await queued();
    await win.evaluate(async () => { const { Events } = await import('/js/events.js'); Events.emit('flows:open'); });
    await win.waitForTimeout(15000);
    const all = await queued();
    const slow = (list) => list.filter(e => e.q > 3000);
    console.log(`landing: ${landing.length} media loads, ${slow(landing).length} queued >3 s, worst ${Math.round(Math.max(0, ...landing.map(e => e.q)))} ms`);
    console.log(`+flows: ${all.length} media loads, ${slow(all).length} queued >3 s, worst ${Math.round(Math.max(0, ...all.map(e => e.q)))} ms`);
    console.log(slow(all).slice(0, 15).map(e => `  ${Math.round(e.q)}ms ${e.n}`).join('\n'));
  } finally {
    await app.close();
  }
  const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8').split('\n').filter(l => /slow-load/.test(l));
  console.log(`${log.length} [slow-load] lines`);
})().catch((e) => { console.error(e); process.exit(1); });
