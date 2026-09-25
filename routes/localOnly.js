'use strict';

/**
 * routes/localOnly.js — the server answers Cubric Studio itself and nobody else (MPI-921).
 *
 * Binding 127.0.0.1 keeps other MACHINES out, not other web pages: any tab in the user's
 * browser can reach loopback. Until MPI-921 `app.use(cors())` also handed every such page
 * `Access-Control-Allow-Origin: *`, so a site could generate, delete projects or create a
 * billing RunPod pod. No caller needs cross-origin access — the renderer is served from this
 * same origin, and every other client (the CLI, agent tools, scripts, tests) is Node, which
 * CORS never applied to. So there is no allowlist; a browser request must be same-origin.
 *
 * Three checks, one per way in:
 *   Host           — DNS rebinding: evil.example re-resolved to 127.0.0.1 is same-origin to
 *                    ITSELF, so it sends no cross-site signal. Only its Host gives it away.
 *   Origin         — every cross-origin fetch/XHR and every cross-site form POST carries it,
 *                    including the "simple" requests CORS never preflights.
 *   Sec-Fetch-Site — a no-cors GET (<img>, <script>, a link) carries no Origin, but does
 *                    carry this. `none` is a typed URL or bookmark, which is fine.
 * Node clients send neither Origin nor Sec-Fetch-Site, so they pass on Host alone.
 */

const logger = require('./logger');

function localOnly(port) {
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const origins = new Set([...hosts].map(h => `http://${h}`));
    return (req, res, next) => {
        const { host, origin } = req.headers;
        const site = req.headers['sec-fetch-site'];
        if (hosts.has(host)
            && (!origin || origins.has(origin))
            && (!site || site === 'same-origin' || site === 'none')) return next();
        logger.warn('system', `Refused ${req.method} ${req.path}: host=${host} origin=${origin} sec-fetch-site=${site}`);
        res.status(403).json({ error: 'This server only answers Cubric Studio itself.' });
    };
}

module.exports = { localOnly };
