/**
 * services/eventStream.js — the renderer's ONE server-sent-events connection
 * (MPI-1142). Connector jobs, the agent, concat and downloads/uploads/engine all
 * arrive on GET /events/stream (routes/eventStream.js).
 *
 * Chromium allows 6 sockets per host. One stream per channel kept four of them
 * open for the app's lifetime, so pictures, videos and every fetch shared the
 * last two, and a slow Pod poll in one of those queued thumbnails for seconds.
 *
 * `onStream(name, fn)` hands `fn` the raw MessageEvent (callers parse `e.data`)
 * and returns its unsubscribe. `onStreamOpen(fn)` runs on every (re)connect; the
 * server re-sends its connect snapshots then. A dropped stream is reopened 3 s
 * later — the policy the downloads stream had (MPI-291).
 */

import { on } from '../utils/dom.js';
import { clientLogger } from './clientLogger.js';

const RECONNECT_MS = 3000;
const CLOSED = 2;   // EventSource.CLOSED

let _es = null;
const _handlers = new Map();   // event name -> Set<fn>
const _openFns = new Set();

function _bind(es, name) {
    on(es, name, (e) => { for (const fn of _handlers.get(name)) fn(e); });
}

function _connect() {
    const es = new EventSource('/events/stream');
    _es = es;
    for (const name of _handlers.keys()) _bind(es, name);
    on(es, 'open', () => { for (const fn of _openFns) fn(); });
    on(es, 'error', () => {
        if (_es !== es) return;
        clientLogger.warn('eventStream', `stream dropped — reconnecting in ${RECONNECT_MS / 1000}s`);
        es.close();
        _es = null;
        setTimeout(() => { if (!_es) _connect(); }, RECONNECT_MS);
    });
}

/** Open the stream if it is not open. Returns true when it had to (re)connect. */
export function ensureStream() {
    if (_es && _es.readyState !== CLOSED) return false;
    _connect();
    return true;
}

/** Listen for one named server event. Opens the stream on first use. */
export function onStream(name, fn) {
    if (!_handlers.has(name)) {
        _handlers.set(name, new Set());
        if (_es) _bind(_es, name);
    }
    _handlers.get(name).add(fn);
    ensureStream();
    return () => _handlers.get(name).delete(fn);
}

/** Run `fn` on every (re)connect, before that connection's snapshots arrive. */
export function onStreamOpen(fn) {
    _openFns.add(fn);
    ensureStream();
    return () => _openFns.delete(fn);
}
