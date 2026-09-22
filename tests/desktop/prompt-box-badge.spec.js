// @ts-check
// MPI-899 probe: does the model badge ever carry a batch count the current model cannot run?
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('an uncaught renderer error reaches app.log with its stack', async ({}, testInfo) => {
  test.setTimeout(60000);
  const { app, window } = await launchApp(testInfo);
  try {
    const posted = await window.evaluate(async () => {
      const bodies = [];
      const real = window.fetch;
      window.fetch = (url, opts) => {
        if (url === '/log') bodies.push(JSON.parse(opts.body));
        return real(url, opts);
      };
      setTimeout(() => { throw new Error('mpi899-sync'); });
      Promise.reject(new Error('mpi899-async'));
      await new Promise(r => setTimeout(r, 200));
      window.fetch = real;
      return bodies;
    });
    const sync = posted.find(b => b.message === 'mpi899-sync');
    const async_ = posted.find(b => b.message === 'mpi899-async');
    expect(sync?.category).toBe('uncaught');
    expect(sync?.detail).toContain('Error: mpi899-sync');
    expect(async_?.category).toBe('unhandledrejection');
    expect(async_?.detail).toContain('Error: mpi899-async');
  } finally {
    await closeApp(app);
  }
});

test('badge batch count follows the current model', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
  try {
    const log = await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const [{ Events }, { MpiPromptBox }, { getModelById }, { PROMPT_BOX_CONTROLS }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
        import('/js/data/modelRegistry.js'),
        import('/js/components/Organisms/MpiPromptBox/PromptBoxControls.js'),
      ]);
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
      Events.emit('ui:close-all-popups');
      const out = [];
      const mk = (id, model) => {
        const host = document.createElement('div');
        host.id = id;
        document.body.appendChild(host);
        return MpiPromptBox.mount(host, { model, modelList: [getModelById('sdxl-realistic'), getModelById('krea2')], operation: 't2i' });
      };
      const badge = (id) => document.querySelector(`#${id} .mpi-prompt-box__settings-badge-host`)?.textContent.replace(/\s+/g, ' ').trim();
      const setBatch = (v) => {
        PROMPT_BOX_CONTROLS.batch._instance?.el?.setValue?.(String(v));
        PROMPT_BOX_CONTROLS.batch.value = String(v);
        Events.emit('settings:shared:update', { mediaType: 'image', key: 'batch', value: v });
      };

      const a = mk('pb-a', getModelById('sdxl-realistic'));
      setBatch(4);
      out.push(['A sdxl batch4', badge('pb-a')]);
      a.el.setModel(getModelById('krea2'));
      out.push(['A -> krea2', badge('pb-a')]);

      // Second box on SDXL, then its batch moves while A sits on Krea 2.
      const b = mk('pb-b', getModelById('sdxl-realistic'));
      setBatch(3);
      out.push(['B sdxl batch3', badge('pb-b'), 'A:', badge('pb-a')]);
      a.el.setModel(getModelById('sdxl-realistic'));
      out.push(['A -> sdxl', badge('pb-a')]);
      b.el.setModel(getModelById('krea2'));
      out.push(['B -> krea2', badge('pb-b'), 'A:', badge('pb-a')]);
      return out;
    });
    console.log(JSON.stringify(log, null, 1));
  } finally {
    await closeApp(app);
  }
});
