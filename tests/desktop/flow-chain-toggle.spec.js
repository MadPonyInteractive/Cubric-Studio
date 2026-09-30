const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-997 — the chain toggle on a Flow's result (Character Sheet's Headless front body).
 *
 * A flow whose `chain` edits leg 1's picture behind a `when` toggle lands leg 2 as the
 * card's NEXT VERSION. The result pane then carries that toggle: pressed = the leg-2 version
 * is showing, and pressing it swaps to the partner version — in the pane AND on the card
 * (`selectedIndex`), because the card is what the gallery, a video model and the agent read.
 *
 * Driven off a fixture flow with a seeded two-version card, so no model runs. The one path
 * it does not reach is "no leg-2 version yet → run leg 2", which needs a real engine: that
 * is the live check in tasks/MPI-997/validation.md.
 */
test.setTimeout(90000);

test('the chain toggle swaps a card between leg 1 and leg 2 versions', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    const result = await window.evaluate(async () => {
      const { MpiBaseFlow } = await import('/js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js');
      const { state } = await import('/js/state.js');

      // Two distinguishable 1x1 PNGs: the pane's <img> src says which version is showing.
      const png = (rgb) => {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        const g = c.getContext('2d');
        g.fillStyle = rgb;
        g.fillRect(0, 0, 1, 1);
        return c.toDataURL('image/png');
      };
      const sheet = { id: 'v-sheet', type: 'image', operation: 'mpi997A', url: png('#f00'), filePath: png('#f00') };
      const headless = { id: 'v-headless', type: 'image', operation: 'mpi997B', url: png('#00f'), filePath: png('#00f') };

      // The mount HEAD-probes a seeded result (fetch refuses a non-GET to data:), and a
      // version swap persists through /update-project. Both answered here, nothing else.
      const realFetch = window.fetch.bind(window);
      const persisted = [];
      window.fetch = (url, opts) => {
        if (opts?.method === 'HEAD' && String(url).startsWith('data:')) return Promise.resolve({ ok: true });
        if (String(url).includes('/update-project')) {
          persisted.push(JSON.parse(opts.body).updates.itemGroups[0].selectedIndex);
          return Promise.resolve(new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } }));
        }
        return realFetch(url, opts);
      };

      const flow = {
        id: 'mpi997-chain-fixture', title: 'Chain fixture', description: 'Frame contract fixture.',
        operation: 'mpi997A', mediaType: 'image', requiredModels: [],
        chain: { operation: 'mpi997B', when: 'Input_Remove_Head', input: 'image1' },
        fields: [{ id: 'Input_Remove_Head', type: 'toggle', label: 'Headless front body', icon: 'eraser', default: true }],
      };
      const prevProject = state.currentProject;
      state.currentProject = {
        ...(prevProject || {}), folderPath: 'C:/mpi997-fixture',
        itemGroups: [{ id: 'card-1', type: 'image', name: 'Sheet', history: [sheet, headless], selectedIndex: 1 }],
      };
      state.s_flowResults = { ...state.s_flowResults, [flow.id]: { items: [headless], mode: null, status: '', pending: false } };
      state.s_flowInputs = {};

      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
      document.body.appendChild(host);
      const inst = MpiBaseFlow.mount(document.createElement('div'), { flow, initialInputs: {} });
      host.appendChild(inst.el);
      inst.el.open?.();
      await new Promise(r => setTimeout(r, 600));
      inst.el.querySelector('#flow-next')?.click();
      await new Promise(r => setTimeout(r, 500));

      const read = () => {
        const btn = inst.el.querySelector('.mpi-base-flow__result-chain button');
        return {
          buttons: inst.el.querySelectorAll('.mpi-base-flow__result-chain').length,
          label: btn?.querySelector('.mpi-ibtn__label')?.textContent ?? null,
          active: !!btn?.classList.contains('is-active'),
          shows: inst.el.querySelector('.mpi-base-flow__result-media img')?.getAttribute('src') ?? null,
          selected: state.currentProject.itemGroups[0].selectedIndex,
        };
      };
      const press = async () => {
        inst.el.querySelector('.mpi-base-flow__result-chain button')?.click();
        await new Promise(r => setTimeout(r, 500));
      };

      const onOpen = read();
      await press();
      const afterFirst = read();
      await press();
      const afterSecond = read();

      inst.el.destroy?.();
      inst.el.remove();
      host.remove();
      window.fetch = realFetch;
      state.currentProject = prevProject;
      delete state.s_flowResults[flow.id];
      return { onOpen, afterFirst, afterSecond, persisted, sheet: sheet.url, headless: headless.url };
    });

    expect(result.onOpen.buttons, 'one chain toggle on the result').toBe(1);
    expect(result.onOpen.label, 'it is the flow\'s own toggle').toBe('Headless front body');
    expect(result.onOpen.active, 'pressed while the leg-2 version shows').toBe(true);
    expect(result.onOpen.shows).toBe(result.headless);

    expect(result.afterFirst.shows, 'first press: back to the untouched sheet').toBe(result.sheet);
    expect(result.afterFirst.selected, 'the CARD swaps too').toBe(0);
    expect(result.afterFirst.active).toBe(false);

    expect(result.afterSecond.shows, 'second press: the headless version, no re-run').toBe(result.headless);
    expect(result.afterSecond.selected).toBe(1);
    expect(result.afterSecond.active).toBe(true);

    expect(result.persisted, 'each swap is written to the project').toEqual([0, 1]);
    expect(pageErrors, 'no renderer errors').toEqual([]);
  } finally {
    await closeApp(app);
  }
});
