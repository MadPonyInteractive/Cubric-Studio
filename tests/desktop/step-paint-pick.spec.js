// @ts-check
// MPI-801 (Fabio 2026-10-02): the Flows' paint step (Scribble, Draw It In) gets the eyedropper
// Pick every tool colour has. The native EyeDropper needs a real click on screen, so this pins
// the wiring: Pick is mounted beside the swatch, and a colour set through the field reaches
// the step's value (the same path a pick takes, MpiColorField.setHex).
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('the paint step has a Pick beside its colour, and a picked colour reaches the brush', async ({}, testInfo) => {
  test.setTimeout(60000);
  const { app, window } = await launchApp(testInfo);
  try {
    const out = await window.evaluate(async () => {
      const { MpiStepPaint } = await import('/js/components/Organisms/MpiStepPaint/MpiStepPaint.js');
      const host = document.createElement('div');
      host.style.cssText = 'width:800px;height:600px';
      document.body.appendChild(host);
      const changes = [];
      const step = MpiStepPaint.mount(host, {
        media: null,
        value: { fields: { canvasSize: '512x512' } },
        onChange: (v) => changes.push(v?.color),
        step: { id: 'draw', kind: 'paint' },
      });
      const field = host.querySelector('.mpi-color-field');
      const pick = host.querySelector('.mpi-color-field__pick button, .mpi-color-field__pick .mpi-button');
      field?.setHex?.('#12ab34');
      const color = step.el.getValue()?.color;
      step.destroy?.();
      return { hasField: !!field, hasPick: !!pick, eyeDropper: 'EyeDropper' in window, color, lastChange: changes.at(-1) };
    });
    expect(out.hasField).toBe(true);
    expect(out.eyeDropper).toBe(true);
    expect(out.hasPick).toBe(true);
    expect(String(out.color).toLowerCase()).toBe('#12ab34');
    expect(String(out.lastChange).toLowerCase()).toBe('#12ab34');
  } finally {
    await closeApp(app);
  }
});
