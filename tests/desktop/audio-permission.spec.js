/**
 * MPI-573. Electron answers renderer permission requests itself, and a refused
 * getUserMedia comes back with no prompt, no dialog and nothing in the log — the
 * recorder simply never arms, which reads as a broken component rather than as a
 * denied permission. The handler in main.js is the whole fix, and nothing else in
 * the app exercises it, so it can regress silently. This spec is the alarm.
 *
 * Installing that handler also INVERTED the default for every other permission, so
 * the two the app already relied on are asserted here too: `fullscreen` (the video
 * control bar, focus mode) and `pointerLock` (MpiRadialMenu, the operation picker).
 * Both fail silently when refused.
 *
 * MPI-803 adds `speaker-selection`, which Chromium gates `setSinkId` on. Refused, the
 * Settings output-device picker accepts a choice and changes nothing.
 */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('the renderer is granted microphone, speaker selection, fullscreen and pointer lock', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    // NotAllowedError is the permission being refused — this spec's whole subject.
    // NotFoundError is a machine with no microphone, which a CI runner legitimately
    // is; that must not fail the build, so the assertion names the one error that
    // means the app is broken rather than requiring a device to exist.
    const mic = await window.evaluate(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(t => t.stop());
        return 'granted';
      } catch (e) {
        return e.name;
      }
    });
    expect(mic, 'microphone permission was refused — the recorder cannot arm')
      .not.toBe('NotAllowedError');

    // permissions.query goes through the CHECK handler, the synchronous twin of the
    // request handler. It is what labels the device list in Settings, and it can be
    // wired wrong while the request handler is right.
    const states = await window.evaluate(async () => {
      const out = {};
      for (const name of ['microphone']) {
        try { out[name] = (await navigator.permissions.query({ name })).state; }
        catch (e) { out[name] = `query-failed:${e.name}`; }
      }
      return out;
    });
    expect(states.microphone).not.toBe('denied');

    // MPI-803. `setSinkId` is how the Settings output picker routes playback. Spec'd
    // behind a `speaker-selection` permission, but MEASURED on this Electron the
    // `media` grant already covers it: a real output device id is accepted with
    // `speaker-selection` absent from ALLOWED_PERMISSIONS, so it is deliberately NOT
    // in that set. This is the alarm for the day that changes — refused, the picker
    // accepts a choice and silently keeps playing to the OS default endpoint, which
    // is the exact symptom it exists to fix. A runner with no audio device falls back
    // to a made-up id, where NotFoundError is the healthy answer.
    const sink = await window.evaluate(async () => {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const real = devs.find(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default');
      const id = real ? real.deviceId : 'not-a-real-device-id';
      try { await new Audio().setSinkId(id); return 'accepted:' + (real ? 'real' : 'bogus'); }
      catch (e) { return e.name + ':' + (real ? 'real' : 'bogus'); }
    });
    expect(sink, 'speaker-selection was refused — the output device picker cannot apply')
      .not.toBe('NotAllowedError');

    const fullscreen = await window.evaluate(async () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      try { await el.requestFullscreen(); await document.exitFullscreen(); return 'ok'; }
      catch (e) { return e.name; }
      finally { el.remove(); }
    });
    expect(fullscreen, 'fullscreen was refused — the video control bar and focus mode break')
      .toBe('ok');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
