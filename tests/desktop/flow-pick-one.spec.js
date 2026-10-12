const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow, SHELL_URL_RE } = require('./shellWindow');

// MPI-1071 — `inputSchema.pickOne`: Transcribe takes a recording OR a video. Both filled,
// the graph silently used the recording, so once one slot is filled the other greys out
// and takes nothing until the filled one is removed (Fabio, 2026-10-12). Pins both
// directions: a flag that disabled unconditionally would leave the Flow with no input.
test('Transcribe: a filled recording disables the video slot until it is removed', async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data');
  fs.mkdirSync(userDataDir, { recursive: true });

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.CUBRIC_E2E = '1';
  env.CUBRIC_E2E_USER_DATA = userDataDir;

  const app = await electron.launch({ args: ['.'], env });

  try {
    const window = await shellWindow(app);
    await expect(window).toHaveURL(SHELL_URL_RE);

    const result = await window.evaluate(async () => {
      const { MpiBaseFlow } = await import('/js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js');
      const { getFlowById } = await import('/js/data/flowsRegistry.js');
      const flow = getFlowById('transcribe');

      // A 44-byte silent WAV: the slot only needs a url it can render as filled.
      const WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
      document.body.appendChild(host);

      const inst = MpiBaseFlow.mount(document.createElement('div'), {
        flow,
        initialInputs: { mediaItems: [{ mediaType: 'audio', role: 'audio1', url: WAV }] },
      });
      host.appendChild(inst.el);
      inst.el.open?.();
      await new Promise(r => setTimeout(r, 400));

      const disabled = () => [...inst.el.querySelectorAll('.mpi-base-flow__slot--disabled')]
        .map(s => s.closest('.mpi-base-flow__slot-unit')?.textContent.trim());

      const out = { withAudio: disabled() };
      inst.el.querySelector('.mpi-base-flow__slot-clear')?.click();
      await new Promise(r => setTimeout(r, 300));
      out.afterClear = disabled();
      out.slots = inst.el.querySelectorAll('.mpi-base-flow__slot').length;

      inst.el.destroy?.();
      host.remove();
      return out;
    });

    expect(result.slots).toBe(2);
    expect(result.withAudio).toHaveLength(1);
    expect(result.withAudio[0]).toContain('Or a video');
    expect(result.afterClear).toEqual([]);
  } finally {
    await app.close();
  }
});
