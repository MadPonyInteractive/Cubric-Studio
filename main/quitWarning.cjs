/**
 * quitWarning.cjs — MPI-792
 *
 * What the quit confirmation says, from GET /comfy/downloads/active. Kept out of
 * main.js so it can be tested without Electron.
 *
 * An engine job (install, upgrade, repair, the first-start pip pass) gets its own
 * wording: users closed an install that looked stuck and came back to a broken
 * engine, so the dialog says plainly that it is still installing, and the default
 * button keeps it going.
 */

/**
 * @param {{ models?: object[], engine?: boolean } | null} active
 * @returns {{ title: string, message: string, detail: string, buttons: string[] } | null}
 *   null when quitting interrupts nothing. buttons[0] quits, buttons[1] stays.
 */
function quitWarning(active) {
    const modelCount = Array.isArray(active?.models) ? active.models.length : 0;
    const engine = !!active?.engine;
    if (!modelCount && !engine) return null;

    const detail = [];
    if (engine) {
        detail.push('Quitting now interrupts it. It starts again the next time you open Cubric Vision, and may need to download some files again.');
    }
    if (modelCount) {
        detail.push(`${modelCount} model download${modelCount === 1 ? '' : 's'} will resume from the existing partial file on next launch.`);
    }

    return engine
        ? {
            title: 'The engine is still installing',
            message: 'Quit while the ComfyUI engine is installing?',
            detail: detail.join('\n'),
            buttons: ['Quit anyway', 'Keep installing'],
        }
        : {
            title: 'Downloads are still running',
            message: 'Quit Cubric Vision while downloads are active?',
            detail: detail.join('\n'),
            buttons: ['Quit', 'Cancel'],
        };
}

module.exports = { quitWarning };
