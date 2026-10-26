/**
 * A tool-options panel's persisted settings, `project.toolSettings[toolKey]` (AUDIT D4).
 *
 * Eight `MpiToolOptions*` panels each carried the same per-key debounce, and each
 * one's `destroy` CLEARED the pending timers. So a setting changed less than the
 * debounce before the tool closed (a rail switch, leaving the page) was silently
 * dropped (AUDIT B2). `dispose()` sends what is still waiting instead.
 *
 * A write sent at close then sits in projectService's own queue for a moment, so a
 * panel reopened inside that window must read through it: `readToolSettings` overlays
 * the pending writes, as `MpiMaskStrip` already did.
 */
import { Events } from '../events.js';
import { state } from '../state.js';
import { getToolSettings } from '../data/projectModel.js';
import { getPendingToolSettings } from './projectService.js';

/**
 * The open project's settings for `toolKey`, including writes still queued.
 * @param {string} toolKey
 * @param {Object} defaults
 * @returns {Object}
 */
export function readToolSettings(toolKey, defaults) {
    return {
        ...getToolSettings(state.currentProject || {}, toolKey, defaults),
        ...getPendingToolSettings(toolKey),
    };
}

/**
 * Debounced per-key writes for one panel's settings.
 * @param {string} toolKey
 * @param {{ delayMs?: number }} [opts]
 * @returns {{ persist: (key: string, value: unknown) => void, dispose: () => void }}
 *   `dispose()` sends every write still waiting; call it from the panel's `destroy`.
 */
export function toolSettingsWriter(toolKey, { delayMs = 200 } = {}) {
    const timers = new Map();
    const pending = new Map();
    const send = (key) => {
        clearTimeout(timers.get(key));
        timers.delete(key);
        if (!pending.has(key)) return;
        const value = pending.get(key);
        pending.delete(key);
        Events.emit('settings:tool:update', { toolKey, key, value });
    };
    return {
        persist(key, value) {
            pending.set(key, value);
            clearTimeout(timers.get(key));
            timers.set(key, setTimeout(() => send(key), delayMs));
        },
        dispose() {
            for (const key of [...pending.keys()]) send(key);
        },
    };
}
