// MPI-1142: where do the 5,203 elements live, and what does re-attaching the gallery rows cost?
// usage: node where.cjs <scratch dir> <project name>
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
process.env.CUBRIC_PORT = '47417';
const { _electron: electron } = require(REPO + '/node_modules/@playwright/test');
const { shellWindow } = require(REPO + '/tests/desktop/shellWindow');

(async () => {
  const SCR = process.argv[2];
  const PROJECT = path.join(SCR, 'docs', 'Cubric Studio', 'Projects', process.argv[3]);
  const userData = path.join(SCR, 'ud-where');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userData, APP_DOCUMENTS: path.join(SCR, 'docs') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  try {
    const win = await shellWindow(app, 60000);
    await win.setViewportSize({ width: 1600, height: 900 }).catch(() => {});
    await win.waitForTimeout(4000);
    await win.evaluate(async (folderPath) => (await fetch('/connector/open-project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath }),
    })).json(), PROJECT);
    await win.waitForTimeout(12000);
    console.log(JSON.stringify(await win.evaluate(() => {
      const count = (el) => el.getElementsByTagName('*').length + 1;
      const out = {};
      const walk = (el, depth) => {
        for (const c of el.children) {
          const n = count(c);
          if (n < 300) continue;
          const k = `${'  '.repeat(depth)}${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''}.${[...c.classList].slice(0, 2).join('.')}`;
          out[k] = `${n} el, ${c.getElementsByTagName('video').length} video, visible=${c.checkVisibility?.()}`;
          if (depth < 6) walk(c, depth + 1);
        }
      };
      walk(document.body, 0);
      return out;
    }), null, 1));
    console.log(JSON.stringify(await win.evaluate(() => {
      const wraps = [...document.querySelectorAll('.mpi-gallery-grid__row-wrap')];
      const by = {};
      for (const w of wraps) for (const el of w.querySelectorAll('*')) {
        const k = `${el.tagName.toLowerCase()}.${el.classList[0] || ''}`; by[k] = (by[k] || 0) + 1;
      }
      const vids = {};
      for (const v of document.querySelectorAll('.mpi-gallery-grid__grid video')) { const k = `${v.className} src=${v.getAttribute('src') ? 'set' : 'none'}`; vids[k] = (vids[k] || 0) + 1; }
      return { cards: wraps.length, top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25), vids };
    }), null, 0));
    // re-attach the grid rows as the render does, then force style: what does it cost?
    console.log(await win.evaluate(() => {
      const grid = document.querySelector('.mpi-gallery-grid__grid, .mpi-gallery-grid [class*="__grid"]') || document.querySelector('.mpi-gallery-grid__row')?.parentElement;
      if (!grid) return 'no grid';
      const rows = [...grid.children];
      const t0 = performance.now(); getComputedStyle(grid).paddingLeft; const t1 = performance.now();
      const frag = document.createDocumentFragment(); rows.forEach(r => frag.appendChild(r)); grid.replaceChildren(frag);
      const t2 = performance.now(); void grid.scrollHeight; const t3 = performance.now();
      return `grid ${grid.className}: ${grid.getElementsByTagName('*').length} el; clean style read ${(t1 - t0).toFixed(1)} ms, re-attach ${(t2 - t1).toFixed(1)} ms, style+layout after ${(t3 - t2).toFixed(1)} ms`;
    }));
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
