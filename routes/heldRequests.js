/**
 * routes/heldRequests.js — names what held the renderer's connections while a load queued (MPI-1142).
 *
 * The app server is HTTP/1.1 on one host, so Chromium gives the renderer 6 sockets to it.
 * A request the server keeps open (an EventSource, a paused video's range request) holds
 * one for its whole life; enough of them and every picture queues until one lets go.
 * `[slow-load]` only sees the victim, so it gets this list of holders appended.
 */
const HELD_MS = 3000;
const KEEP = 200;

const _open = new Map(); // res → { url, start }
const _ended = [];       // the last KEEP requests that lasted HELD_MS or more

const _decode = (url) => { try { return decodeURIComponent(url); } catch (_) { return url; } };

/** Express middleware: remembers every request until it ends. */
function trackHeldRequests(req, res, next) {
    const rec = { url: req.originalUrl, start: Date.now() };
    _open.set(res, rec);
    const end = () => {
        if (!_open.delete(res)) return;
        rec.end = Date.now();
        if (rec.end - rec.start < HELD_MS) return;
        _ended.push(rec);
        if (_ended.length > KEEP) _ended.shift();
    };
    res.on('finish', end);
    res.on('close', end);
    next();
}

/**
 * " | held: …" for a `[slow-load]` message, naming every request that was open for
 * HELD_MS or more at some point in the load's window (its duration back from now).
 * @param {string} message  the slow-load line; its first "<n>ms" is the load's duration
 * @param {number} [now]
 * @param {{ open?: Iterable<object>, ended?: object[] }} [src]  test seam
 */
function describeHeld(message, now = Date.now(), src = { open: _open.values(), ended: _ended }) {
    const duration = Number(/(\d+)ms/.exec(message)?.[1] || 0);
    const from = now - duration - 1000; // the POST /log lands a moment after the load ends
    const held = [...src.open, ...src.ended]
        .filter((r) => r.start <= now && (r.end ?? now) >= from && (r.end ?? now) - r.start >= HELD_MS)
        .map((r) => `${_decode(r.url)} ${Math.round(((r.end ?? now) - r.start) / 1000)}s${r.end ? '' : ' open'}`);
    return ` | held: ${held.length ? held.join(', ') : 'none'}`;
}

module.exports = { trackHeldRequests, describeHeld };
