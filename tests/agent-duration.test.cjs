'use strict';

/**
 * agent-duration.test.cjs — MPI-820.
 *
 * `duration` was missing from the agent's named params, so NO agent-dispatched video ever
 * carried `Input_Duration` and every one ran the value baked into the workflow file. For
 * H3 that is 2, which snaps to 56 frames / 2.33 s — BELOW the 124–362 trained range — while
 * the app's own slider said 5 the whole time. Fabio hit it live on 2026-09-19: he set 3 s
 * in the panel and the card came back 2 s.
 *
 * The two things these tests hold down:
 *  1. duration reaches `Input_Duration` at all, on the ops that take one and nowhere else.
 *  2. what we REPORT is what the run will really be. H3 snaps onto a frame grid, so the ask
 *     and the result differ, and the snapping lives in a python node in another repo. The
 *     last test pins our copy against that node's own constants.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const {
    resolveNamedParams, namedParamsFor, snapH3Frames, effectiveDuration,
    modelShowsDuration, isValidDuration, DURATION_MIN, DURATION_MAX,
} = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const H3 = MODELS.find((m) => m.id === 'minimax-h3');
const CLIP_OPS = (H3.supportedOps || []).filter((op) => modelShowsDuration(H3, op));

test('H3 still declares clip ops with a duration — the rest of this file assumes it', () => {
    assert.ok(H3, 'minimax-h3 must exist');
    assert.ok(CLIP_OPS.length > 0, 'H3 must have at least one op that takes a duration');
});

// ── it reaches the graph ──────────────────────────────────────────────────────

test('an asked duration reaches Input_Duration', () => {
    for (const op of CLIP_OPS) {
        const r = resolveNamedParams(null, H3, op, { duration: 8 });
        assert.equal(r.ok, true, op);
        assert.equal(r.injectionParams.Input_Duration, 8, op);
    }
});

test('an UNSET duration no longer falls through to the workflow`s baked 2', () => {
    // The bug, exactly: no key at all meant the graph kept its own 2 (56 frames, below the
    // trained range) while the app's slider said 5.
    for (const op of CLIP_OPS) {
        const r = resolveNamedParams(null, H3, op, {});
        assert.equal(r.ok, true, op);
        assert.equal(typeof r.injectionParams.Input_Duration, 'number',
            `${op}: an unset duration must still inject one, or the baked default wins`);
        // 3 s, Fabio's own trade (2026-09-19): 5 s is the first value inside H3's trained
        // range, but it is a long wait, and what you wait for is the FIRST latent, which
        // comes later on a longer clip. Anything but the baked 2 is the point here.
        assert.equal(r.injectionParams.Input_Duration, 3, `${op}: the unset default`);
    }
});

test('the project`s saved duration wins over the default, and an explicit ask wins over both', () => {
    const op = CLIP_OPS[0];
    const project = { shared: { video: { duration: 12 } } };
    assert.equal(resolveNamedParams(project, H3, op, {}).injectionParams.Input_Duration, 12);
    assert.equal(resolveNamedParams(project, H3, op, { duration: 4 }).injectionParams.Input_Duration, 4);
    // This is the pinned-panel path: the panel's own value is what runs (MPI-774 Phase 7).
});

test('duration is refused on an op that makes a still, and out of range', () => {
    const stillOps = (H3.supportedOps || []).filter((op) => !modelShowsDuration(H3, op));
    for (const op of stillOps) {
        assert.equal(resolveNamedParams(null, H3, op, { duration: 5 }).code, 'INVALID_DURATION', op);
    }
    const op = CLIP_OPS[0];
    for (const bad of [0, 31, -1, '5', null, NaN]) {
        assert.equal(resolveNamedParams(null, H3, op, { duration: bad }).code, 'INVALID_DURATION',
            `duration ${JSON.stringify(bad)} must be refused`);
    }
    assert.equal(isValidDuration(DURATION_MIN), true);
    assert.equal(isValidDuration(DURATION_MAX), true);
});

test('describe_model advertises duration on a clip op and not on a still', () => {
    for (const op of CLIP_OPS) {
        assert.deepEqual(namedParamsFor(H3, op).duration, { min: DURATION_MIN, max: DURATION_MAX }, op);
    }
    const still = MODELS.find((m) => m.mediaType === 'image');
    for (const op of (still.supportedOps || [])) {
        assert.equal(namedParamsFor(still, op).duration, null, `${still.id}/${op}`);
    }
});

// ── it reports the truth ──────────────────────────────────────────────────────

test('the reported duration is what the run gets, not what was asked', () => {
    // Fabio's own case: the panel said 3, the card said 2-point-something.
    assert.deepEqual(effectiveDuration(H3, 2), { seconds: 56 / 24, frames: 56, inTrainedRange: false });
    assert.deepEqual(effectiveDuration(H3, 6), { seconds: 141 / 24, frames: 141, inTrainedRange: true });
    // 8 s is the shortest ask that lands on a whole second.
    assert.deepEqual(effectiveDuration(H3, 8), { seconds: 8, frames: 192, inTrainedRange: true });
    // A model without the grid takes the seconds it is given.
    const wan = MODELS.find((m) => m.type === 'wan');
    if (wan) assert.deepEqual(effectiveDuration(wan, 6), { seconds: 6, frames: null, inTrainedRange: null });

    const r = resolveNamedParams(null, H3, CLIP_OPS[0], { duration: 6 });
    assert.equal(r.duration.seconds, 141 / 24, 'the resolver hands back the REAL length');
    assert.equal(r.injectionParams.Input_Duration, 6, 'while the graph is still asked for 6');
});

test('snapping is NEAREST, never up — snapping up maximises the error', () => {
    // 4 s = 96 frames: 90 (3.75 s) is closer than core`s own 107 (4.46 s).
    assert.equal(snapH3Frames(96), 90);
    assert.equal(snapH3Frames(5), 5);
    assert.equal(snapH3Frames(1), 5, 'never below the first grid point');
    for (let f = 1; f <= 400; f++) assert.equal(snapH3Frames(f) % 17, 5, `snap(${f}) must be on the grid`);
});

// ── our copy vs the node that actually does it ────────────────────────────────

test('the H3 grid matches the node that applies it, or every reported duration is wrong', () => {
    // The authority is ComfyUi-MpiNodes/h3.py; this module only PREDICTS it so an answer can
    // state the real length. A change there that is not mirrored here silently makes every
    // reported duration wrong, which is the failure this test exists to make loud.
    const nodePath = path.join('C:', 'AI', 'Mpi', 'ComfyUi-MpiNodes', 'h3.py');
    if (!fs.existsSync(nodePath)) {
        // The sibling repo is not checked out on this machine (CI). Skip rather than fail:
        // the constants above are still asserted by every other test in this file.
        return;
    }
    const py = fs.readFileSync(nodePath, 'utf8');
    const num = (name) => {
        const m = new RegExp(`^${name}\\s*=\\s*([0-9.]+)`, 'm').exec(py);
        assert.ok(m, `${name} not found in h3.py — the node was restructured, re-check this mirror`);
        return Number(m[1]);
    };
    assert.equal(num('FPS'), 24);
    assert.equal(num('_GRID'), 17);
    assert.equal(num('_OFFSET'), 5);
    assert.equal(num('TRAINED_MIN'), 124);
    assert.equal(num('TRAINED_MAX'), 362);
    // And the snap itself agrees across the two implementations.
    const pySnap = (frames) => Math.max(5, Math.round((frames - 5) / 17) * 17 + 5);
    for (let f = 1; f <= 400; f++) assert.equal(snapH3Frames(f), pySnap(f), `frame ${f}`);
});

// ── the agent's own tool carries them ─────────────────────────────────────────

/**
 * The half that the resolver tests above cannot see. `duration` shipped through the route,
 * the resolver and the injection, and the system prompt grew a Duration rule telling the
 * agent to judge the length itself — while the agent's `generate` TOOL never declared the
 * key and never forwarded it. The schema is `additionalProperties: false`, so the model
 * could not even emit it: every agent video fell to the default, and the chat still quoted
 * the length the agent had decided on. Found 2026-09-19 reading the file, not by a test.
 *
 * This asserts the whole class rather than the one key, so the next named param cannot
 * repeat it: the route's accepted set is the contract, and the tool must carry all of it.
 */
test('every named param the connector accepts is declared AND forwarded by the agent tool', () => {
    const connector = fs.readFileSync(path.join(__dirname, '..', 'routes', 'connector.js'), 'utf8');
    const loop = fs.readFileSync(path.join(__dirname, '..', 'services', 'agentLoop.mjs'), 'utf8');

    const keysSrc = /const NAMED_PARAM_KEYS = \[([^\]]+)\]/.exec(connector);
    assert.ok(keysSrc, 'NAMED_PARAM_KEYS not found in routes/connector.js — it was renamed or moved');
    const keys = [...keysSrc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.ok(keys.length >= 6, `expected the full named-param set, got ${keys.join(', ')}`);

    // The `generate` tool's schema block, bounded by the next tool so the Duration rule's
    // prose further down the file cannot satisfy the assertion by accident.
    const from = loop.indexOf("name: 'generate'");
    const to = loop.indexOf("name: 'look'", from);
    assert.ok(from > 0 && to > from, 'the generate / look tool blocks were not found in agentLoop.mjs');
    const schema = loop.slice(from, to);

    for (const key of keys) {
        // `batch` is the loop's, not the model's: the model sends `count`, and `_fanOut`
        // turns it into a batch where the model can take one (MPI-876 phase 2).
        if (key === 'batch') {
            assert.match(loop, /body\.batch = opts\.batchSize/, 'the loop no longer forwards its batch');
            continue;
        }
        assert.match(schema, new RegExp(`\\b${key}:\\s*\\{`),
            `'${key}' is accepted by the connector but not declared on the agent's generate tool — with additionalProperties:false the model cannot send it at all`);
        assert.match(loop, new RegExp(`body\\.${key} = `),
            `'${key}' is declared on the agent's generate tool but never forwarded into the connector body`);
    }
});

// ── and the route between them carries them ───────────────────────────────────

/**
 * The THIRD half, found live 2026-09-19 on Fabio's duck-and-pony clip: the agent said "about
 * 6 seconds", the card came back "3S". The resolver took a duration and the tool sent one,
 * and `POST /connector/generate` sat between them with `duration` in NAMED_PARAM_KEYS - so
 * its validation block fired - while never reading the key off the body, never validating
 * it and never putting it on the job input. Accepted, then dropped.
 *
 * Driven through the real route rather than read off its source: what matters is what
 * reaches the renderer, and a regex over the file is how the last two halves got past.
 */
test('every named param the route accepts reaches the dispatched job input', async () => {
    const express = require('express');
    const connectorPath = require.resolve('../routes/connector.js');
    const router = require(connectorPath);

    const app = express();
    app.use(express.json());
    app.use(router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;

    const stream = new AbortController();
    try {
        // The renderer's side of the contract: subscribe, take the job, report back.
        const sse = await fetch(`${base}/connector/jobs/stream`, { signal: stream.signal });
        const reader = sse.body.getReader();

        const sent = { ratio: '9:16', qualityTier: 'medium', turbo: true, duration: 6 };
        const submit = fetch(`${base}/connector/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId: H3.id, operation: CLIP_OPS[0], positive: 'x', ...sent }),
        });

        let buffer = '';
        let job = null;
        while (!job) {
            const { value, done } = await reader.read();
            assert.ok(!done, 'the job stream closed before the submit became a job');
            buffer += Buffer.from(value).toString('utf8');
            const frame = /event: job\ndata: (.+)\n\n/.exec(buffer);
            if (frame) job = JSON.parse(frame[1]);
        }
        await fetch(`${base}/connector/jobs/${job.jobId}/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, output: {} }),
        });
        assert.equal((await (await submit).json()).ok, true);

        assert.equal(job.capability, 'generation.submit');
        for (const [key, value] of Object.entries(sent)) {
            assert.deepEqual(job.input[key], value,
                `'${key}' was accepted by the route and never reached the job input - the run falls to a default while the agent narrates what it asked for`);
        }
    } finally {
        stream.abort();
        server.closeAllConnections();
        server.close();
    }
});
