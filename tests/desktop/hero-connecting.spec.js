const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-908 — while a RunPod pod connects, the landing crew gives the stage to Studio's
 * connecting scenes (js/shell/heroCrew.js, the band), cycled bare, and takes it back when
 * the connect resolves: on a success through a transition and Studio connected (the band's
 * ONLY transition, Fabio 2026-09-25), on a failure straight back. Driven by `remote:connection` emits, the ones Settings makes, so no pod
 * is needed.
 */
test.setTimeout(90000);

test('landing: a connecting pod swaps the crew for the connecting band, and back', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.waitForTimeout(6000); // shell boot settles
    const stage = window.locator('.mpi-landing__crew');
    const liveScene = window.locator('.mpi-landing__crew-band-clip.mpi-landing__crew-clip--live');
    const emit = (payload) => window.evaluate(async (p) => {
      const { Events } = await import('/js/events.js');
      Events.emit('remote:connection', p);
    }, payload);
    const connecting = () => emit({ connected: false, phase: 'connecting' });
    const crewPlaying = () => expect.poll(() => window.evaluate(() =>
      [...document.querySelectorAll('.mpi-landing__crew-member .mpi-landing__crew-clip--live')].filter(v => !v.paused).length,
    ), { timeout: 5000 }).toBe(5);

    await expect(window.locator('.mpi-landing__crew-member')).toHaveCount(5);
    await expect(stage).not.toHaveClass(/mpi-landing__crew--connecting/);

    await connecting();
    const fx = window.locator('.mpi-landing__crew-band .mpi-landing__crew-fx');
    // No transition in: the scene takes the stage at once.
    await expect(stage).toHaveClass(/mpi-landing__crew--connecting/);
    await expect(liveScene).toHaveAttribute('src', 'assets/mascot/studio/connecting-sparks.webm');
    // Off stage, the crew decodes nothing.
    expect(await window.evaluate(() => [...document.querySelectorAll('.mpi-landing__crew-member video')].every(v => v.paused))).toBe(true);

    // Scenes play in turn, bare: sparks (8s) hands to spit-out with no transition.
    await expect(liveScene).toHaveAttribute('src', 'assets/mascot/studio/connecting-spit-out.webm', { timeout: 12000 });
    await expect(fx).not.toHaveAttribute('src', /./);

    // Success: a transition, Studio connected plays once (5.2s), then the crew comes back.
    await emit({ connected: true, phase: null });
    await expect(fx).toHaveAttribute('src', /studio\/transition-/);
    await expect(liveScene).toHaveAttribute('src', 'assets/mascot/studio/connected.webm', { timeout: 2000 });
    await expect(stage).toHaveClass(/mpi-landing__crew--connecting/);
    await expect(stage).not.toHaveClass(/mpi-landing__crew--connecting/, { timeout: 8000 });
    await expect(liveScene).toHaveCount(0);
    // Back on stage, every member plays again.
    await crewPlaying();

    // Failure: no connected scene, straight back to the crew.
    await connecting();
    await expect(stage).toHaveClass(/mpi-landing__crew--connecting/);
    await emit({ connected: false, phase: null });
    await expect(stage).not.toHaveClass(/mpi-landing__crew--connecting/);
    await expect(fx).not.toHaveAttribute('src', /./);
    await expect(liveScene).toHaveCount(0);
    await crewPlaying();

    expect(pageErrors).toEqual([]);
  } finally {
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('remote:connection', { connected: false, phase: null });
    }).catch(() => {});
    await closeApp(app);
  }
});
