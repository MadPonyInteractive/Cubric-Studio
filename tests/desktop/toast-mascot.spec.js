// MPI-907 (Fabio, 2026-09-25): a toast shows a STILL of the right mascot - the op's for a
// toast about a job, Studio (Cosmo) otherwise. Stills, not clips: at 54px a clip does not read.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('toast: a still per variant, from the named mascot; "error" is a failure', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    const shown = await window.evaluate(async () => {
      const { MpiToast } = await import('/js/components/Primitives/MpiToast/MpiToast.js');
      const cases = [
        { variant: 'info' }, { variant: 'success', mascot: 'video' },
        { variant: 'warning', mascot: 'audio' }, { variant: 'error' },
      ];
      return cases.map((props) => {
        const wrap = document.createElement('div');
        document.body.appendChild(wrap);
        const t = MpiToast.mount(wrap, { message: 'x', duration: 0, sound: false, ...props });
        const el = t.el || document.querySelector('.mpi-toast-stack > .mpi-toast:last-child');
        return { src: el.querySelector('.mpi-toast__mascot').getAttribute('src'), label: el.querySelector('.mpi-toast__label').textContent };
      });
    });
    expect(shown).toEqual([
      { src: 'assets/mascot/studio/idle.webp', label: 'Info' },
      { src: 'assets/mascot/video/happy.webp', label: 'Done' },
      { src: 'assets/mascot/audio/greet.webp', label: 'Heads up' },
      { src: 'assets/mascot/studio/idle.webp', label: 'Failed' },
    ]);
    // Every still the variants can ask for exists, for all five mascots.
    const missing = await window.evaluate(async () => {
      const out = [];
      for (const key of ['studio', 'vision', 'video', 'audio', 'prompt']) {
        for (const pose of ['idle', 'happy', 'greet']) {
          const res = await fetch(`assets/mascot/${key}/${pose}.webp`);
          if (!res.ok) out.push(`${key}/${pose}`);
        }
      }
      return out;
    });
    expect(missing).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
