// MPI-1142: ranged responses (video/audio) carry Cache-Control: no-store, plain ones do not (server.js).
// usage: node nostore.cjs <scratch dir holding docs/Cubric Studio/Projects/*>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47406';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const DOCS = path.join(process.argv[2], 'docs');
  const userData = path.join(process.argv[2], 'ud-nostore');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: DOCS };
  delete env.ELECTRON_RUN_AS_NODE;
  // Any project video, served by /project-file.
  const projects = path.join(DOCS, 'Cubric Studio', 'Projects');
  let video = null;
  for (const p of fs.readdirSync(projects)) {
    const media = path.join(projects, p, 'Media');
    const hit = fs.existsSync(media) && fs.readdirSync(media).find(f => /\.mp4$/i.test(f));
    if (hit) { video = path.join(media, hit); break; }
  }
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    const probe = (url, range) => win.evaluate(async ([u, r]) => {
      const res = await fetch(u, { headers: r ? { Range: 'bytes=0-1023' } : {}, cache: 'no-store' });
      return `${res.status} cache-control=${res.headers.get('cache-control')}`;
    }, [url, range]);
    const clip = '/assets/mascot/video/idle-1.webm';
    const pf = video ? `/project-file?path=${encodeURIComponent(video)}` : null;
    console.log('static clip, range   :', await probe(clip, true));
    console.log('static clip, no range:', await probe(clip, false));
    console.log('static picture       :', await probe('/assets/mascot/video/idle.webp', false));
    if (pf) {
      console.log('project video, range :', await probe(pf, true));
      console.log('project video, plain :', await probe(pf, false));
    }
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
