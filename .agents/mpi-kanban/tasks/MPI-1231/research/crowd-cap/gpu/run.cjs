// MPI-1231 fixes 3+4: ONE Storyboard GPU run in MY OWN Electron instance (own profile, port,
// APP_DOCUMENTS; the engine on 48188 is shared). Calls the real driver (FLOW_DRIVERS.storyboard)
// in the real renderer with Fabio's bat-cave idea and the re-plan from research/crowd-cap/out.json.
// Run from the repo root, under the GPU lease.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/AI/Mpi/Cubric-Vision';
const HERE = __dirname.replace(/\\/g, '/');
process.env.CUBRIC_PORT = '54791';
const { _electron: electron } = require(`${REPO}/node_modules/@playwright/test`);
const { shellWindow } = require(`${REPO}/tests/desktop/shellWindow`);

const OUT = JSON.parse(fs.readFileSync(`${REPO}/.agents/mpi-kanban/tasks/MPI-1231/research/crowd-cap/out.json`, 'utf8'));
const META = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Tikori Characters/Media/.meta/0fa8f162-8124-4754-a539-e24651bea462.json';
const IDEA = JSON.parse(fs.readFileSync(META, 'utf8')).flowInputs.positive;

(async () => {
  const profile = `${HERE}/profile`; const docs = `${HERE}/documents`; const folderPath = `${HERE}/project`;
  for (const d of [profile, docs, folderPath]) fs.mkdirSync(d, { recursive: true });
  const project = { id: 'sb22-batcave', name: 'Storyboard 22 bat cave', modelSettings: {}, itemGroups: [] };
  fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));

  const env = { ...process.env, CUBRIC_BACKGROUND: '1', CUBRIC_USER_DATA_ROOT: profile, APP_DOCUMENTS: docs, CUBRIC_PORT: process.env.CUBRIC_PORT };
  delete env.ELECTRON_RUN_AS_NODE; delete env.CUBRIC_E2E; delete env.CUBRIC_E2E_USER_DATA;
  const app = await electron.launch({ args: ['.'], cwd: REPO, env });
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
  try {
    const win = await shellWindow(app);
    win.on('pageerror', e => log('PAGEERROR', String(e)));
    win.on('console', m => { if (m.type() === 'error') log('CONSOLE', m.text().slice(0, 300)); });
    log('window up');
    await new Promise(r => setTimeout(r, 25000)); // engine attach + model scan
    const res = await win.evaluate(async ({ p, idea, plan }) => {
      const [{ state }, { navigate, PAGE_GALLERY }, { FLOW_DRIVERS }, { FLOWS, flowModelIds }, { StatusBar }] = await Promise.all([
        import('/js/state.js'), import('/js/router.js'), import('/js/shell/storyboardDispatch.js'),
        import('/js/data/flowsRegistry.js'), import('/js/shell/statusBar.js')]);
      const toasts = [];
      const notify = StatusBar.notify.bind(StatusBar);
      StatusBar.notify = (t, v) => { toasts.push(`[${v}] ${t}`); return notify(t, v); };
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise(r => setTimeout(r, 1500));
      const flow = FLOWS.find(f => f.id === 'storyboard');
      if (!flow) return { error: 'no storyboard flow (dev gate?)' };
      const model = flowModelIds(flow)[0];
      const jobs = [];
      const run = await FLOW_DRIVERS.storyboard(flow, { positive: idea, plan, ratio: '16:9', qualityTier: '1k', turbo: true,
        panelCount: 6, pictureNotes: '', mediaItems: [] }, { onJob: (id) => jobs.push(id), stopped: () => false });
      if (!run) return { model, started: false, toasts };
      const out = await run.finished;
      return { model, started: true, jobs: jobs.length, toasts, out: { ok: out.ok, cancelled: out.cancelled, reordered: out.reordered, overview: out.overview,
        panels: (out.panels || []).map(r => ({ index: r.index, ok: !!r.groupId, file: r.item?.filePath, error: r.error })) } };
    }, { p: { ...project, folderPath }, idea: IDEA, plan: OUT.plan.replace(/\r?\n/g, '') });
    log('RESULT', JSON.stringify(res, null, 2));
    fs.writeFileSync(`${HERE}/result.json`, JSON.stringify(res, null, 2));
  } finally {
    await app.close().catch(() => {});
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
