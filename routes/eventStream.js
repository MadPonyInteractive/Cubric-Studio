'use strict';
/**
 * routes/eventStream.js — ONE server-sent-events connection for every channel the
 * renderer keeps open (MPI-1142).
 *
 *   GET /events/stream — connector jobs + agent + concat + downloads/uploads/engine
 *
 * Chromium allows 6 sockets per host. Four always-open streams (one per channel) left
 * every picture, video and fetch two slots, and on a busy Pod each slow poll took one
 * of those for seconds: thumbnails and mascots queued 3-60 s (live net log 2026-10-16).
 *
 * Each channel exports `attach(res) -> detach`: it adds the response to its own
 * subscriber set exactly as its old per-channel route did, and every channel already
 * writes whole `event: name\ndata: ...\n\n` frames in one write, so frames never
 * interleave. Event names are unique across channels (job, agent:*, bench:*,
 * concat:*, download:*, upload:*, engine:*, comfy:needs-restart/restarted), plus the
 * channel-less `projects:changed` that `broadcast()` sends to every stream.
 *
 * The per-channel routes stay for callers that want one channel (the connector tests
 * stand in for the renderer on /connector/jobs/stream); the app opens only this one.
 */

const express = require('express');

const router = express.Router();

function openSse(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();
}

/** One channel on its own SSE route, the shape every per-channel route had. */
function serveChannel(attach) {
    return (req, res) => {
        openSse(res);
        const detach = attach(res);
        res.write('event: connected\ndata: {}\n\n');
        req.on('close', detach);
    };
}

// Every open /events/stream, for events that belong to no channel (MPI-1323).
const _clients = new Set();

/**
 * Tell every open renderer something changed on the server: one whole frame per write,
 * like every channel's. A dead socket is dropped, never retried.
 */
function broadcast(name, data = {}) {
    const frame = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of _clients) {
        try { res.write(frame); } catch { _clients.delete(res); }
    }
}

router.get('/events/stream', (req, res) => {
    openSse(res);
    _clients.add(res);
    // Required at request time: these modules require this one for serveChannel.
    const detaches = [
        require('./connector').attachJobs,
        require('./agent').attachEvents,
        require('./videoConcat').attachEvents,
        require('./downloadManager').attachEvents,
    ].map((attach) => attach(res));
    res.write('event: connected\ndata: {}\n\n');
    req.on('close', () => {
        _clients.delete(res);
        detaches.forEach((detach) => detach());
    });
});

module.exports = router;
module.exports.serveChannel = serveChannel;
module.exports.broadcast = broadcast;
