/**
 * MPI-824. A pinned output device whose id stops resolving must SHOW as unavailable.
 *
 * The complaint this comes from: "I had restarted the app and my audio settings changed.
 * The output changed." Nothing had changed the setting — the stored deviceId no longer
 * resolved, `applySink` fell back to the OS default with a warn in app.log, and the
 * Settings dropdown mounted with a `value` that was not in its `options`, so it rendered
 * the placeholder. The panel read "System default" while a dead id sat in the store and
 * was still being applied on every play. The setting appeared to have changed itself.
 *
 * The unit suite (`tests/audio-output.test.cjs`) pins the healing. What it cannot answer
 * is what the PANEL says, which is the half the user actually experienced. This mounts the
 * real Settings component on a real Electron shell and reads the rendered dropdown.
 *
 * `enumerateDevices` is stubbed rather than trusted: a CI runner has no audio hardware, and
 * a spec that needs a real device is the green-locally-red-in-CI shape (docs/red-master.md,
 * cause 1). The stub IS the runner's condition, provoked deliberately.
 */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

const KEY = 'mpi_audio_output_device';
const PRESENT = { deviceId: 'speakers-id', label: 'Speakers (Focusrite USB Audio)' };
const GONE = { deviceId: 'sonar-dead-id', label: 'SteelSeries Sonar - Media' };

test('a stored output device that no longer resolves is named, not hidden behind the placeholder', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    const result = await window.evaluate(async ({ KEY, PRESENT, GONE }) => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const { MpiSettings } = await import('/js/components/Compounds/LandingPages/MpiSettings/MpiSettings.js');

      // The device list the panel builds from. Only the output entry matters here.
      const realEnumerate = navigator.mediaDevices.enumerateDevices;
      navigator.mediaDevices.enumerateDevices = async () => ([
        { kind: 'audiooutput', deviceId: PRESENT.deviceId, label: PRESENT.label },
        { kind: 'audioinput', deviceId: 'mic-id', label: 'Microphone (Focusrite USB Audio)' },
      ]);

      const host = document.createElement('div');
      document.body.appendChild(host);
      const stored = localStorage.getItem(KEY);

      /** Mount Settings with `pick` stored, and read what the Output row renders. */
      const readRow = async (pick) => {
        localStorage.setItem(KEY, JSON.stringify(pick));
        const inst = MpiSettings.mount(host);
        inst.el.onOpen();
        await sleep(600);                       // enumerateDevices + the mounts it feeds
        try {
          const slot = inst.el.querySelector('#mpiSettingsAudioOutputSlot');
          const note = inst.el.querySelector('#mpiSettingsAudioOutputNote');

          // MpiDropdown DETACHES its option list at mount and body-appends it on the
          // first open, so the options are reachable neither under the slot nor in the
          // document until the control is actually opened. Open it, the way a user
          // checking their output device would. `data-value` then identifies this row's
          // option without guessing which of the panel's portalled lists is which.
          slot?.querySelector('.mpi-dropdown__trigger')?.click();
          await sleep(120);
          const deadOption = document.querySelector(
            `.mpi-dropdown__option[data-value="${GONE.deviceId}"]`);
          const flagged = deadOption?.querySelector('.mpi-dropdown__option-meta');
          return {
            trigger: slot?.querySelector('.mpi-dropdown__label')?.textContent?.trim() ?? null,
            deadOptionLabel: deadOption?.querySelector('.mpi-dropdown__option-label')
              ?.textContent?.trim() ?? null,
            metaText: flagged?.textContent?.trim() ?? null,
            // A flag meta drops MpiDropdown's 11ch ellipsis cap (MPI-599); without it
            // "Not available" renders as "Not availa…".
            metaIsFlag: flagged?.classList.contains('mpi-dropdown__option-meta--flag') ?? null,
            noteHidden: note?.hidden ?? null,
            // The PROPERTY is not the question — an author `display` rule beats the UA
            // `[hidden]` one silently (MPI-685). Ask the pixels.
            noteDisplay: note ? getComputedStyle(note).display : null,
            noteText: note?.textContent?.trim() ?? '',
          };
        } finally {
          inst?.el?.destroy?.();
          host.innerHTML = '';
        }
      };

      try {
        return { gone: await readRow(GONE), present: await readRow(PRESENT) };
      } finally {
        navigator.mediaDevices.enumerateDevices = realEnumerate;
        if (stored === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, stored);
        host.remove();
      }
    }, { KEY, PRESENT, GONE });

    // ── The device is gone: it is NAMED, and the row says why ────────────────
    // This is the assertion the bug report reduces to. Before MPI-824 this read
    // "System default" — the placeholder — with the dead id still in the store.
    expect(result.gone.trigger).toBe(GONE.label);
    expect(result.gone.deadOptionLabel).toBe(GONE.label);
    expect(result.gone.metaText).toBe('Not available');
    expect(result.gone.metaIsFlag).toBe(true);
    expect(result.gone.noteHidden).toBe(false);
    expect(result.gone.noteDisplay).not.toBe('none');
    expect(result.gone.noteText).toContain(GONE.label);
    expect(result.gone.noteText).toContain('system default');

    // ── The device is there: no scare row, no note ───────────────────────────
    expect(result.present.trigger).toBe(PRESENT.label);
    expect(result.present.deadOptionLabel).toBeNull();
    expect(result.present.metaText).toBeNull();
    expect(result.present.noteHidden).toBe(true);
    expect(result.present.noteDisplay).toBe('none');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app, testInfo);
  }
});
