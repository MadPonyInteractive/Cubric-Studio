/**
 * elapsedTicker — keeps a long wait visibly alive (MPI-792).
 *
 * An install step can print nothing for minutes: a multi-GB unpack, a pip build that
 * says one line and then works for half an hour. With only a label on screen that has
 * stopped changing, that reads as a hang, and users quit mid-install. The ticker gives
 * the screen one thing that always moves and is always true, the elapsed time, and
 * after a quiet stretch with no `touch()` it rotates a hint saying quiet is normal.
 */

/**
 * @param {number} ms
 * @returns {string} 75000 → "1:15", 3725000 → "1:02:05"
 */
export function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * Calls `onTick` now and once a second until `stop()`.
 * @param {(elapsed: string, hint: string|null) => void} onTick
 * @param {object} [opts]
 * @param {string[]} [opts.hints]            rotated while nothing has happened for a while
 * @param {number}   [opts.quietAfterMs=15000] silence before the first hint shows
 * @param {number}   [opts.rotateMs=8000]    how long each hint stays
 * @returns {{ touch: () => void, stop: () => void }} `touch` = "something just happened"
 */
export function startElapsedTicker(onTick, { hints = [], quietAfterMs = 15000, rotateMs = 8000 } = {}) {
    const started = Date.now();
    let lastActivity = started;
    const tick = () => {
        const now = Date.now();
        const quietFor = now - lastActivity - quietAfterMs;
        const hint = hints.length && quietFor >= 0
            ? hints[Math.floor(quietFor / rotateMs) % hints.length]
            : null;
        onTick(formatClock(now - started), hint);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return {
        touch: () => { lastActivity = Date.now(); },
        stop: () => clearInterval(timer),
    };
}
