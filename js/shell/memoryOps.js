/**
 * memoryOps.js — Global VRAM and RAM release operations.
 *
 * TWO runtimes hold this card's VRAM, not one. ComfyUI is the obvious one; Ollama is
 * the other, and it keeps a model resident for five minutes after the last request —
 * a 12B agent model is ~8GB of a 16GB card. Until MPI-774 Phase 7 this only spoke to
 * ComfyUI, so pressing Release VRAM with the agent loaded freed nothing that mattered.
 */

import { Hotkeys } from '../managers/hotkeyManager.js';

/**
 * Triggers memory release and updates the monitor UI.
 * @param {boolean} isDeep - If true, performs a deep clean (unload everything).
 * @param {HTMLElement} monitorEl - The MpiMemoryMonitor component element.
 */
export async function triggerMemoryRelease(isDeep = false, monitorEl) {
  const statusPrefix = isDeep ? 'Deep Cleaning...' : 'Releasing VRAM...';
  if (monitorEl?.showStatus) monitorEl.showStatus(statusPrefix);

  try {
    // Unload ComfyUI models
    const comfyRes = await fetch('/comfy/unload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deep: isDeep }),
    }).catch(() => null);

    // Fallback to direct ComfyUI API if the internal proxy fails
    if (comfyRes && !comfyRes.ok) {
      // Port MUST match `COMFYUI_PORT` in routes/shared.js (MPI-434).
      await fetch('http://127.0.0.1:48188/extra/unload_models', { method: 'POST' }).catch(() => null);
    }

    // The other runtime. The route answers ok even when Ollama is absent or empty, and
    // this is caught anyway: a machine without Ollama must still release ComfyUI's VRAM.
    await fetch('/llm/ollama/unload', { method: 'POST' }).catch(() => null);

    if (monitorEl?.showStatus) {
      monitorEl.showStatus(isDeep ? 'Deep Clean ✓' : 'VRAM Released ✓');
    }
  } catch (err) {
    console.error('[shell/memoryOps] Global unload failed:', err);
    if (monitorEl?.showStatus) {
      monitorEl.showStatus('Unload Failed');
    }
  }
}

/**
 * Registers the F5/Ctrl+F5 global hotkeys for memory release.
 * @param {HTMLElement} monitorEl - The monitor element to update.
 */
export function bindMemoryHotkeys(monitorEl) {
  Hotkeys.bind('memory.refresh',      () => triggerMemoryRelease(false, monitorEl));
  Hotkeys.bind('memory.refresh.deep', () => triggerMemoryRelease(true,  monitorEl));
}
