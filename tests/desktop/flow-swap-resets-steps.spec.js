// @ts-check
// MPI-1014 Phase 4 (Fabio 2026-10-04, his look at Object Stamp): a NEW object loaded into a
// Flow slot kept the OLD object's step state — the cutout step showed the old erase mask and
// the old background cut, and after back/forward Remove Background ran on the new object but
// kept the old mask (the squirrel's body erased, only its tail left). "If I press reset, it's
// fixed." The slot's X button already dropped the drawing bound to its role (MPI-620); the
// two SWAP paths (picker pick, upload/drop) just overwrote the item. This drives a real swap
// through the picker and asserts every step bound to the image comes back clean — its own
// step AND the one that reads it through `sourceRole` (Place) — while the step's declared
// fields survive, and that re-picking the SAME picture keeps the drawing.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('a new image in a Flow slot resets the steps bound to it, keeping their fields', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
  try {
    const out = await window.evaluate(async () => {
      const { MpiBaseFlow } = await import('/js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js');
      const { getFlowById } = await import('/js/data/flowsRegistry.js');
      const { state } = await import('/js/state.js');
      const flow = getFlowById('object-stamp');

      const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf'
        + 'FcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      // Two picker cards: the object already in the slot, and a different one.
      const card = (id, filePath) => ({
        id, type: 'image', customName: id, selectedIndex: 0,
        history: [{ id: `${id}-1`, type: 'image', filePath }],
      });
      state.currentProject = {
        id: 'e2e-swap', name: 'E2E swap', folderPath: 'C:/e2e-swap', modelSettings: {},
        itemGroups: [card('old-object', `${PNG}#old`), card('new-object', `${PNG}#new`)],
      };
      // `seeded` prefers the persisted inputs over `initialInputs`.
      state.s_flowInputs = {};

      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
      document.body.appendChild(host);
      const inst = MpiBaseFlow.mount(document.createElement('div'), {
        flow,
        initialInputs: {
          mediaItems: [
            { mediaType: 'image', role: 'image1', url: `${PNG}#scene` },
            { mediaType: 'image', role: 'image2', url: `${PNG}#old` },
          ],
          stepValues: {
            image2: { removeBg: true, bgUrl: 'old-cut.png', erase: 'old-mask' },
            image1: { region: { x: 1, y: 2, w: 3, h: 4 }, halfW: 0.2, fields: { positive: 'keep me' } },
          },
        },
      });
      host.appendChild(inst.el);
      inst.el.open?.();
      await new Promise(r => setTimeout(r, 400));

      const pick = async (name) => {
        const slots = [...inst.el.querySelectorAll('.mpi-base-flow__slot')];
        slots[1].click();
        await new Promise(r => setTimeout(r, 400));
        const tile = [...document.querySelectorAll('.mpi-media-picker__tile-media')]
          .find(t => t.title === name);
        tile?.click();
        await new Promise(r => setTimeout(r, 400));
        return !!tile;
      };
      const read = () => JSON.parse(JSON.stringify(state.s_flowInputs?.[flow.id]?.stepValues || {}));

      const samePicked = await pick('old-object');
      const afterSame = read();
      const newPicked = await pick('new-object');
      const afterNew = read();
      const object = state.s_flowInputs?.[flow.id]?.mediaItems?.find(m => m.role === 'image2')?.url;

      inst.el.destroy?.();
      host.remove();
      return { samePicked, afterSame, newPicked, afterNew, object };
    });

    expect(out.samePicked).toBe(true);
    expect(out.newPicked).toBe(true);
    expect(out.object).toMatch(/#new$/);
    // The same picture re-picked keeps the drawing.
    expect(out.afterSame.image2).toMatchObject({ removeBg: true, bgUrl: 'old-cut.png', erase: 'old-mask' });
    expect(out.afterSame.image1).toMatchObject({ halfW: 0.2 });
    // A NEW picture: its own step (cutout) is clean…
    expect(out.afterNew.image2).toBeUndefined();
    // …and the step that reads it (place, `sourceRole: 'image2'`) too, keeping its typed field.
    expect(out.afterNew.image1).toEqual({ fields: { positive: 'keep me' } });
  } finally {
    await closeApp(app);
  }
});
