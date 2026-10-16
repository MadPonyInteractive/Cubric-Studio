// MPI-1142 check: how many server-sent-event streams does an idle app hold open, and do the
// channels still deliver? Isolated app only (own port + profile). usage: node streams.cjs <scratch dir>
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
const PORT = '47397';
process.env.CUBRIC_PORT = PORT;
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

const established = () => execSync('netstat -ano').toString().split('\n')
  .filter(l => l.includes('ESTABLISHED') && l.split(/\s+/)[3] === `127.0.0.1:${PORT}`).length;

(async () => {
  const userData = path.join(process.argv[2], 'ud-streams');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const docs = path.join(process.argv[2], 'docs-streams');
  fs.mkdirSync(docs, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: docs };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    const cdp = await win.context().newCDPSession(win);
    await cdp.send('Network.enable');
    await win.reload();
    const streams = new Map();
    cdp.on('Network.requestWillBeSent', (e) => { if (e.type === 'EventSource') streams.set(e.requestId, e.request.url.replace(/^.*:\d+/, '')); });
    const gone = (e) => streams.delete(e.requestId);
    cdp.on('Network.loadingFinished', gone);
    cdp.on('Network.loadingFailed', gone);
    await win.waitForTimeout(12000);
    console.log('open EventSources after boot:', [...streams.values()]);
    console.log('sockets held to the server:', established());

    const r = await win.evaluate(async () => {
      const caps = await (await fetch('/connector/capabilities')).json();
      const { state } = await import('/js/state.js');
      return { generationSubmit: caps.generationSubmit, downloadJobsIsArray: Array.isArray(state.downloadJobs) };
    });
    console.log('connector channel attached (generationSubmit):', r.generationSubmit);

    // Downloads channel: the server broadcasts download:snapshot to every subscriber on a new connect.
    const got = await win.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      return await new Promise((resolve) => {
        const off = Events.on('download:snapshot', () => { off(); resolve(true); });
        fetch('/comfy/downloads/stream').then((res) => res.body.cancel());  // a second subscriber connects -> snapshot to all
        setTimeout(() => resolve(false), 5000);
      });
    });
    console.log('download:snapshot reached the bus over the shared stream:', got);
  } finally {
    await app.close();
  }
})();
