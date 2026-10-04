// @ts-check
// MPI-1014 (Fabio 2026-10-04, his pre-cut smoke): a 32K photo showed a broken image in a Flow's
// Inputs slot and a 16K painted in strip by strip; Draw It In's paint step was unusable. The
// History canvas had drawn a server DISPLAY copy past the cap since MPI-961; the Flow screens
// still decoded the original. This pins the Flow half: each step screen decodes the copy, never
// the original, and still reports its box / crop / paint size in the ORIGINAL's px — and the
// run-time paint layer is built at most 4096 on its long edge (a 16K one was a ~1 GB canvas).
//
// The photo is made here with sharp and is NOT a project card: a Flow's uploaded file lives in
// `.preview-assets` with no sidecar, the case whose copy used to fall back to the original.
// `setDisplayMaxEdge(256)` makes a 2048 photo "big", the MPI-961 spec trick.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('every Flow step screen draws the display copy and keeps the original\'s px', async ({}, testInfo) => {
  test.setTimeout(90000);
  const dir = testInfo.outputPath('.preview-assets');
  fs.mkdirSync(dir, { recursive: true });
  const photo = path.join(dir, 'big.png');
  await sharp({ create: { width: 2048, height: 1024, channels: 3, background: '#7f6a55' } }).png().toFile(photo);

  const { app, window } = await launchApp(testInfo);
  try {
    const out = await window.evaluate(async (file) => {
      // Boot alone fills Chromium's 250-entry resource buffer; later loads are then dropped.
      performance.clearResourceTimings();
      performance.setResourceTimingBufferSize(2000);
      const { setDisplayMaxEdge } = await import('/js/utils/displayImage.js');
      setDisplayMaxEdge(256);
      const { MpiStepPaint, composePaintLayer } = await import('/js/components/Organisms/MpiStepPaint/MpiStepPaint.js');
      const { MpiStepBox } = await import('/js/components/Organisms/MpiStepBox/MpiStepBox.js');
      const { MpiStepCrop } = await import('/js/components/Organisms/MpiStepCrop/MpiStepCrop.js');

      const url = `/project-file?path=${encodeURIComponent(file)}`;
      const media = { url, mediaType: 'image' };
      const until = async (read) => {
        for (let i = 0; i < 100; i++) {
          const v = read();
          if (v) return v;
          await new Promise(r => setTimeout(r, 50));
        }
        return null;
      };
      const mount = (Comp, props) => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px';
        document.body.appendChild(host);
        return Comp.mount(host, { onChange: () => {}, ...props });
      };

      const paint = mount(MpiStepPaint, { media, value: null, step: { id: 'draw', kind: 'paint' } });
      const paintSize = await until(() => { const s = paint.el.getValue()?.size; return s?.w > 1 ? s : null; });

      const box = mount(MpiStepBox, { media, value: null, step: { id: 'box', kind: 'box' } });
      const boxValue = await until(() => box.el.getValue()?.box);

      const crop = mount(MpiStepCrop, { media, value: null, step: { id: 'frame', kind: 'crop' } });
      const cropRect = await until(() => { const c = crop.el.getValue()?.crop; return c?.w > 1 ? c : null; });

      // What was decoded: the copy (a `.webp` from the temp cache), never the original PNG.
      const loaded = performance.getEntriesByType('resource')
        .map(e => new URL(e.name))
        .filter(u => u.pathname === '/project-file')
        .map(u => decodeURIComponent(u.searchParams.get('path') || ''));

      // The run-time layer of a 16K photo: built at 4096, not 16384.
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      c.getContext('2d').fillRect(10, 10, 20, 10);
      const layer = await composePaintLayer({ paint: c.toDataURL('image/png'), size: { w: 16384, h: 8192 } });
      const bmp = layer ? await createImageBitmap(layer) : null;

      paint.destroy?.(); box.destroy?.(); crop.destroy?.();
      return { paintSize, boxValue, cropRect, loaded, layer: bmp && { w: bmp.width, h: bmp.height } };
    }, photo);

    expect(out.paintSize).toEqual({ w: 2048, h: 1024 });
    expect(out.boxValue).toMatchObject({ x: 0, y: 0, w: 2048, h: 1024 });
    expect([out.cropRect?.w, out.cropRect?.h]).toEqual([2048, 1024]);
    expect(out.loaded.length).toBeGreaterThan(0);
    expect(out.loaded.every(p => /\.fit256\.webp$/.test(p))).toBe(true);
    expect(out.loaded.some(p => p.endsWith('big.png'))).toBe(false);
    expect(out.layer).toEqual({ w: 4096, h: 2048 });
  } finally {
    await closeApp(app);
  }
});

// MPI-1014 (Fabio 2026-10-04, Object Stamp on a 16K): the cutout brush at its 400 px cap drew a
// ring a few screen px wide. The cutout and paint brushes are in IMAGE px with a default, cap
// and wheel step tuned on a ~1K picture; they now grow with the long edge (`brushScale`), so on
// this 2048 photo the default is 80 and the cap 800.
test('the cutout and paint brushes grow with the picture', async ({}, testInfo) => {
  test.setTimeout(90000);
  const dir = testInfo.outputPath('.preview-assets');
  fs.mkdirSync(dir, { recursive: true });
  const photo = path.join(dir, 'big.png');
  await sharp({ create: { width: 2048, height: 1024, channels: 3, background: '#7f6a55' } }).png().toFile(photo);

  const { app, window } = await launchApp(testInfo);
  try {
    const out = await window.evaluate(async (file) => {
      const { MpiStepPaint } = await import('/js/components/Organisms/MpiStepPaint/MpiStepPaint.js');
      const { MpiStepCutout } = await import('/js/components/Organisms/MpiStepCutout/MpiStepCutout.js');
      const media = { url: `/project-file?path=${encodeURIComponent(file)}`, mediaType: 'image' };
      const until = async (read) => {
        for (let i = 0; i < 100; i++) {
          const v = read();
          if (v) return v;
          await new Promise(r => setTimeout(r, 50));
        }
        return null;
      };
      const probe = async (Comp, kind) => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px';
        document.body.appendChild(host);
        const inst = Comp.mount(host, { media, value: null, step: { id: kind, kind }, onChange: () => {} });
        // Loaded = the default re-derived from the picture's size.
        const start = await until(() => { const b = inst.el.getValue()?.brushSize; return b !== 40 ? b : null; });
        const canvas = host.querySelector('canvas');
        for (let i = 0; i < 300; i++) {
          canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
        }
        const max = inst.el.getValue()?.brushSize;
        inst.destroy?.();
        host.remove();
        return { start, max };
      };
      return { paint: await probe(MpiStepPaint, 'paint'), cutout: await probe(MpiStepCutout, 'cutout') };
    }, photo);

    expect(out.paint).toEqual({ start: 80, max: 800 });
    expect(out.cutout).toEqual({ start: 80, max: 800 });
  } finally {
    await closeApp(app);
  }
});
