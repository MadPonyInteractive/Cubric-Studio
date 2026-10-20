'use strict';

/**
 * routes/licences.js — proving a licence grant at the source (MPI-357).
 *
 * Routes exposed:
 *   POST /licences/verify  — { repoId, probePath, token? } → { ok, status, errorCode, reason, usedSaved }
 *     No `token` = probe with the one saved by an earlier pass. A typed token that passes
 *     is saved, encrypted, in `main/secretsStore.js` (MPI-1215).
 *
 * WHY THIS EXISTS. A few model licences are granted by the licensor to a PERSON, through
 * an access request on their own model page — FLUX.2 Klein 9B is the forcing case. Our
 * consent dialog cannot stand in for that: it records that a user read our copy of the
 * terms, not that Black Forest Labs granted them anything. The only evidence that exists
 * is whether their account can reach the gated files, so we go and ask.
 *
 * WHY SERVER-SIDE, not a fetch from the renderer. Two reasons, both real:
 *   1. A saved token never enters a renderer, a devtools network pane, or clientLogger:
 *      the renderer sends one only when the user types it, and the saved one is read
 *      here over the fork bridge. Until MPI-1215 (2026-10-21) the token was dropped after
 *      one request; Fabio reversed that because every gated licence asked again, and a
 *      user who does not keep tokens had to mint a new one each time. It is stored like
 *      the DeepInfra and RunPod keys (safeStorage), never in the licence receipt.
 *   2. CORS makes the browser answer useless anyway. Hugging Face replies
 *      `Access-Control-Allow-Origin: https://huggingface.co`, so a cross-origin probe
 *      from the app origin fails before any status is readable.
 *
 * WHAT COUNTS AS PROOF. A HEAD at the gated file, and the STATUS is the answer — the body
 * is empty by construction. `redirect: 'manual'` matters: HF answers an authorised LFS
 * file with a 302 into its CDN, so following it would spend a signed CDN round trip to
 * learn what the 302 already said. Any 2xx/3xx = the account has the grant.
 */

// ── Measured against the live API, 2026-08-21 ─────────────────────────────────
//
//   HEAD .../FLUX.2-klein-9B/resolve/main/model_index.json   (GATED)
//     no token                        → 401  X-Error-Code: GatedRepo
//     INVALID token                   → 401  X-Error-Code: GatedRepo
//     VALID token, grant NOT held     → 403                    ← the split
//   HEAD .../FLUX.2-klein-4B/... (an UNGATED repo)
//     INVALID token                   → 307
//
// Two things fall out of that:
//
//  1. THE STATUS IS THE WHOLE ANSWER, and 401 vs 403 is the load-bearing line. 401 means
//     Hugging Face has no usable credential — no token, or a dead one. 403 means it knows
//     exactly who you are and the answer is still no, which is the missing grant. The two
//     need opposite advice ("paste a working token" vs "go accept the licence"), so
//     getting this backwards sends a user round in circles. Measured in BOTH directions:
//     a junk token 401s, and a real token on an account without the grant 403s.
//  2. The probe is only a gate on a repo that is ACTUALLY gated. Aimed at an ungated
//     repo it returns 307 for any string at all — so the descriptor's `repoId` and
//     `probePath` are what make this a gate, and a wrong one fails open exactly like
//     the LICENSE.md probe would have. `tests/licence-gate.test.cjs` pins that live
//     rather than the route re-deriving it on every install.

const express = require('express');
const router = express.Router();
const logger = require('./logger');
const { ask } = require('./forkBridge');

const HF_HOST = 'https://huggingface.co';
// Long enough for a cold DNS + TLS handshake, short enough that a wedged network gives
// the dialog an answer instead of a spinner.
const PROBE_TIMEOUT_MS = 10000;

// `owner/name` and a repo-relative path. The host is hard-pinned above; these two stop a
// `..` segment walking the probe out of the named repo, which is the one way a caller
// could aim it at something ungated and make the gate pass on anything.
const REPO_ID_RE = /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/;
const isSafePath = (p) => typeof p === 'string' && p.length > 0 && !p.startsWith('/')
    && !p.includes('..') && !p.includes('\\');

// The saved token lives in main/secretsStore.js (safeStorage); this forked server reaches
// it only over the fork bridge. Standalone (`npm run server`) both resolve to nothing.
async function getSavedHfToken() {
    const m = await ask('secrets:get-hf-token-request', {});
    return m && typeof m.value === 'string' ? m.value : null;
}

async function saveHfToken(token) {
    const m = await ask('secrets:set-hf-token-request', { token });
    if (!m || !m.ok) logger.warn('licence', 'verify passed but the token could not be saved');
}

router.post('/licences/verify', async (req, res) => {
    const { repoId, probePath, token } = req.body || {};

    if (!REPO_ID_RE.test(String(repoId || ''))) {
        return res.status(400).json({ ok: false, reason: 'bad-request', message: 'Invalid repo id.' });
    }
    if (!isSafePath(probePath)) {
        return res.status(400).json({ ok: false, reason: 'bad-request', message: 'Invalid probe path.' });
    }
    // No token typed = the one saved by an earlier pass (MPI-1215). `usedSaved` tells the
    // gate a failure was the SAVED token, so it can offer the field to replace it.
    const typed = typeof token === 'string' ? token.trim() : '';
    const usedSaved = !typed;
    const probeToken = typed || await getSavedHfToken();
    if (!probeToken || probeToken.length < 8) {
        return res.status(400).json({ ok: false, reason: 'no-token', message: 'Paste your access token to continue.' });
    }

    const url = `${HF_HOST}/${repoId}/resolve/main/${probePath}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);

    try {
        const upstream = await fetch(url, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { Authorization: `Bearer ${probeToken}` },
            signal: ctrl.signal,
        });
        clearTimeout(timer);

        const status = upstream.status;
        const errorCode = upstream.headers.get('x-error-code') || null;
        const ok = status >= 200 && status < 400;

        // 403 = Hugging Face knows who you are and still says no → the grant is missing.
        // 401 = it has no usable credential at all → the token is. See the measurements.
        const reason = ok ? 'granted'
            : status === 403 ? 'not-granted'
            : status === 401 ? 'bad-token'
            : 'upstream-error';

        // repoId and status only. The token is not logged, redacted or otherwise — it is
        // simply never handed to the logger.
        logger.info('licence', `verify ${repoId} -> ${status} ${errorCode || ''} (${reason})${usedSaved ? ' saved token' : ''}`);
        // A typed token that proved a grant is kept, so the next gated licence never asks.
        // Saved only on a pass: a token that just failed is not worth keeping.
        if (ok && !usedSaved) await saveHfToken(typed);
        return res.json({ ok, status, errorCode, reason, usedSaved });
    } catch (err) {
        clearTimeout(timer);
        const offline = err.name === 'AbortError' || !!(err.cause && err.cause.code);
        logger.warn('licence', `verify ${repoId} failed: ${err.name} ${err.message}`);
        return res.json({
            ok: false,
            status: 0,
            errorCode: null,
            reason: offline ? 'offline' : 'upstream-error',
            usedSaved,
        });
    }
});

module.exports = router;
