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
