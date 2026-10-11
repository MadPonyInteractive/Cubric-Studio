// @ts-check
// MPI-1080 (Fabio, 2026-10-11): dragging a reference chip to a new place made the chips
// "jump all over the place". A slow drag across the strip, at the pace a hand moves (one
// pointermove a frame, never waiting for the slide-into-place animation to finish), must
// move the dragged chip one way only, and must never rebuild the chips (a rebuilt chip
// reloads its picture: the flash).
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('a slow chip drag moves one way and never rebuilds the chips', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const [{ Events }, { MpiPromptBox }, { getModelById }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
        import('/js/data/modelRegistry.js'),
      ]);
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
      Events.emit('ui:close-all-popups');
      const mk = (id, modelId, op, n, top) => {
        const host = document.createElement('div');
        host.id = id;
        // On screen, so the strip lays out and animates like the real one.
        host.style.cssText = `position:fixed;left:0;top:${top}px;width:1000px;z-index:99999`;
        document.body.appendChild(host);
        const model = getModelById(modelId);
        const pb = MpiPromptBox.mount(host, { model, modelList: [model], operation: op });
        pb.el.clearMedia();
        pb.el.setOperation(op);
        for (let i = 0; i < n; i++) pb.el.injectMedia({ url: `/assets/mascot/idle.png?${id}${i}`, mediaType: 'image' });
        pb.el.setOperation(op);
      };
      // LTX Reference to Video: tagged chips (Picture n), the strip Fabio saw.
      mk('pb-ltx', 'ltx-23-balanced', 'ref2v_ms', 4, 250);
      // Wan 2.2 image-to-video with two pictures: Start frame / Last frame labels.
      mk('pb-wan', 'wan-22', 'i2v_ms', 2, 550);
    });

    // Drags chip 0 from its centre to past the last chip, one pointermove per frame.
    const slowDrag = (sel) => window.evaluate(async (sel) => {
      const strip = () => [...document.querySelectorAll(`${sel} .mpi-prompt-box-media-strip__chip`)];
      const chips = strip();
      const id = chips[0].dataset.id;
      chips.forEach(c => { c.__orig = true; c.querySelector('img').__orig = true; });
      const a = chips[0].getBoundingClientRect();
      const last = chips[chips.length - 1].getBoundingClientRect();
      const y = a.top + a.height / 2;
      const x0 = a.left + a.width / 2;
      const x1 = last.right + 10;
      chips[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x0, clientY: y }));
      const positions = [];
      // A hand is never steady: every other frame the pointer slips back 4px, so the
      // drag creeps forward 2px a frame. Only crossing a chip's SLOT midpoint moves it.
      for (let i = 0, x = x0; x <= x1; i++, x += (i % 2 ? 6 : -4)) {
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
        positions.push(strip().findIndex(c => c.dataset.id === id));
        await new Promise(r => requestAnimationFrame(r));
      }
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const backSteps = positions.filter((p, i) => i > 0 && p < positions[i - 1]).length;
      const rebuilt = strip().filter(c => !c.__orig || !c.querySelector('img').__orig).length;
      return { backSteps, rebuilt, final: positions[positions.length - 1], count: chips.length, positions };
    }, sel);

    const ltx = await slowDrag('#pb-ltx');
    expect(ltx.backSteps, `LTX positions ${ltx.positions.join(',')}`).toBe(0);
    expect(ltx.rebuilt, 'LTX chips rebuilt mid-drag').toBe(0);
    expect(ltx.final).toBe(ltx.count - 1);

    const wan = await slowDrag('#pb-wan');
    expect(wan.backSteps, `Wan positions ${wan.positions.join(',')}`).toBe(0);
    expect(wan.rebuilt, 'Wan chips rebuilt mid-drag').toBe(0);
    expect(wan.final).toBe(wan.count - 1);
    // The labels still follow the order: the moved picture is now the last frame.
    const roles = await window.locator('#pb-wan .mpi-prompt-box-media-strip__role')
      .evaluateAll(els => els.map(e => e.textContent.trim()));
    expect(roles).toEqual(['Start frame', 'Last frame']);

    // Fabio: "I can never see the full image, it's cropped to 1:1". The frame takes the
    // picture's shape, 80px tall and 80-144px wide, and shows it whole.
    const shapes = await window.evaluate(async () => {
      const pb = document.querySelector('#pb-ltx .mpi-prompt-box');
      const svg = (w, h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="teal"/></svg>`)}`;
      pb.clearMedia();
      pb.injectMedia({ url: svg(1600, 900), mediaType: 'image' });
      pb.injectMedia({ url: svg(900, 1600), mediaType: 'image' });
      pb.injectMedia({ url: svg(3000, 1000), mediaType: 'image' });
      await new Promise(r => setTimeout(r, 500));
      return [...document.querySelectorAll('#pb-ltx .mpi-prompt-box-media-strip__frame')].map(f => ({
        w: Math.round(f.getBoundingClientRect().width),
        h: Math.round(f.getBoundingClientRect().height),
        fit: getComputedStyle(f.querySelector('img')).objectFit,
      }));
    });
    expect(shapes.map(s => s.h)).toEqual([80, 80, 80]);
    expect(shapes[0].w, '16:9 shows at its own width').toBeGreaterThanOrEqual(140);
    expect(shapes[0].w).toBeLessThanOrEqual(144);
    expect(shapes[1].w, 'a tall picture letterboxes inside 80px').toBe(80);
    expect(shapes[2].w, '3:1 is capped at 9rem').toBe(144);
    expect(shapes.every(s => s.fit === 'contain')).toBe(true);
  } finally {
    await closeApp(app);
  }
});
