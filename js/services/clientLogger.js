/**
 * clientLogger.js — Frontend → server log bridge.
 *
 * Writes client-side errors into the same app.log file the server uses,
 * so packaged-app users have a single file to send for support.
 *
 * All calls are fire-and-forget — logging failures are silently swallowed
 * to avoid error-handler infinite loops.
 *
 * Usage:
 *   import { clientLogger } from './clientLogger.js';
 *   clientLogger.error('comfy', 'Workflow failed', err);
 *   clientLogger.warn('gallery', 'No Output node found');
 *   clientLogger.info('comfy', 'Generation started');
 */

'use strict';

import { on } from '../utils/dom.js';

function _send(level, category, message, err) {
    // Also mirror to browser console for dev convenience
    const detail = err ? (err.stack || String(err)) : '';
    if (level === 'error') console.error(`[${category}] ${message}`, err || '');
    else if (level === 'warn') console.warn(`[${category}] ${message}`, err || '');

    fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, category, message, detail }),
    }).catch(() => { /* swallow — logger must never throw */ });
}

export const clientLogger = {
    info  : (category, message)      => _send('info',  category, message),
    // `warn` took only two args until MPI-670, so a passed err was silently dropped
    // and `Media save failed:` reached app.log with nothing after the colon.
    warn  : (category, message, err) => _send('warn',  category, message, err),
    error : (category, message, err) => _send('error', category, message, err),
};

/**
 * Route every renderer error nothing caught into app.log. Without this, a throw inside
 * a click handler (component `emit` has no try/catch) reached DevTools only, so a
 * stale-UI bug Fabio saw live left no trace to diagnose it from (MPI-899).
 */
export function installErrorBridge() {
    on(window, 'error', (e) => {
        _send('error', 'uncaught', e.error?.message || e.message || 'error', e.error || `${e.filename}:${e.lineno}:${e.colno}`);
    });
    on(window, 'unhandledrejection', (e) => {
        _send('error', 'unhandledrejection', e.reason?.message || String(e.reason), e.reason);
    });
}

const SLOW_LOAD_MS = 3000;
// fetch/XHR/EventSource are left out: a generation call or an open stream is long by design.
const SLOW_LOAD_TYPES = new Set(['img', 'image', 'video', 'audio', 'css', 'link', 'script']);

/**
 * One app.log line for a picture, video, sheet or script that took over 3 s, or null.
 * `queued` (start → request sent) is Chromium waiting for a socket or the disk cache;
 * `server` (request → first byte) is the app server; `download` is the body (MPI-1137).
 * @param {PerformanceResourceTiming} e
 * @returns {string|null}
 */
export function describeSlowLoad(e) {
    if (e.duration < SLOW_LOAD_MS || !SLOW_LOAD_TYPES.has(e.initiatorType)) return null;
    const ms = (v) => `${Math.round(v)}ms`;
    let path = e.name;
    try { const u = new URL(e.name); path = u.pathname + u.search; } catch (_) { /* not a URL */ }
    // MPI-1142: queued split three ways. A reused socket reports connectStart = connectEnd
    // = fetchStart, so its wait lands in `after`; a new socket's wait lands in `before`.
    const queued = `queued ${ms(e.requestStart - e.startTime)} (before connect ${ms(e.connectStart - e.startTime)}, `
        + `connect ${ms(e.connectEnd - e.connectStart)}, after ${ms(e.requestStart - e.connectEnd)})`;
    const split = e.requestStart > 0
        ? `${queued}, server ${ms(e.responseStart - e.requestStart)}, download ${ms(e.responseEnd - e.responseStart)}`
        : 'no request sent (cache or failed)';
    return `${e.initiatorType} ${ms(e.duration)} status=${e.responseStatus ?? '?'}: ${split} | ${decodeURIComponent(path)}`;
}

/**
 * Log every slow media load to app.log, always on. Fabio's slow landing after a long idle
 * never reproduces with DevTools open, so the next one has to explain itself (MPI-1137).
 */
export function installSlowLoadLog() {
    if (typeof PerformanceObserver === 'undefined') return;
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            const line = describeSlowLoad(entry);
            if (line) _send('warn', 'slow-load', line);
        }
    }).observe({ type: 'resource', buffered: true });
}

/** Over this much main-thread blocking in a minute, dragging and typing visibly stutter. */
const BLOCKED_MS_PER_MIN = 2000;

/**
 * MPI-1142: dragging lagged after ~17 h of use, engine idle, and a restart wiped the state.
 * Each minute the main thread was blocked over BLOCKED_MS_PER_MIN is a `[health]` warn;
 * every 10 minutes an info line records what can grow (heap, elements, videos, images),
 * so a slow build-up shows as a trend in app.log instead of needing a live look.
 */
export function installHealthLog() {
    let blocked = 0, worst = 0, count = 0, minute = 0;
    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) { blocked += e.duration; worst = Math.max(worst, e.duration); count++; }
        }).observe({ type: 'longtask' });
    }
    setInterval(() => {
        minute++;
        const busy = blocked > BLOCKED_MS_PER_MIN;
        if (busy || minute % 10 === 0) {
            const heap = performance.memory ? `heap ${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB, ` : '';
            _send(busy ? 'warn' : 'info', 'health', `${busy ? 'main thread blocked: ' : ''}${count} long tasks, `
                + `${Math.round(blocked)} ms in 60 s (worst ${Math.round(worst)} ms) | ${heap}`
                + `${document.getElementsByTagName('*').length} elements, ${document.getElementsByTagName('video').length} videos, `
                + `${document.images.length} images, up ${minute} min`);
        }
        blocked = worst = count = 0;
    }, 60000);
}
