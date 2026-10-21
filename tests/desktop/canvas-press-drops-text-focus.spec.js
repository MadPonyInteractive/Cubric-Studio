// @ts-check
// MPI-1220 (Fabio 2026-10-21): typing to Cosmo, then painting a mask, left the chat box
// focused — both paint surfaces preventDefault their mousedown, which also cancels the
// browser's own blur — so B/E and every other brush hotkey typed into the chat. A press on
// either surface must leave no text box focused.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('a press on the canvas or the paint step drops a focused text box', async ({}, testInfo) => {
  test.setTimeout(60000);
  const { app, window } = await launchApp(testInfo);
  try {
    const out = await window.evaluate(async () => {
      const { MpiCanvas } = await import('/js/components/Primitives/MpiCanvas/MpiCanvas.js');
      const { MpiStepPaint } = await import('/js/components/Organisms/MpiStepPaint/MpiStepPaint.js');
      const chat = document.createElement('textarea');
      document.body.appendChild(chat);
      const press = (host) => {
        chat.focus();
        const before = document.activeElement === chat;
        host.querySelector('canvas').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        return { before, after: document.activeElement === chat };
      };
      const mk = () => {
        const h = document.createElement('div');
        h.style.cssText = 'width:800px;height:600px';
        document.body.appendChild(h);
        return h;
      };
      const canvasHost = mk();
      const canvas = MpiCanvas.mount(canvasHost, {});
      const stepHost = mk();
      const step = MpiStepPaint.mount(stepHost, {
        media: null, value: { fields: { canvasSize: '512x512' } }, onChange: () => {}, step: { id: 'draw', kind: 'paint' },
      });
      await new Promise(r => setTimeout(r, 300));
      const res = { canvas: press(canvasHost), step: press(stepHost) };
      step.destroy?.();
      canvas.el.destroy?.();
      chat.remove();
      return res;
    });
    expect(out.canvas.before).toBe(true);
    expect(out.canvas.after).toBe(false);
    expect(out.step.before).toBe(true);
    expect(out.step.after).toBe(false);
  } finally {
    await closeApp(app);
  }
});
