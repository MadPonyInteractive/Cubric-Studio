/**
 * routes/llm.js — the app's own LLM call (MPI-677 step 1a).
 *
 * THE POINT OF THIS FILE: until now Vision had no LLM client of any kind, and
 * the PromptBox's Enhance button called OUT over the broker to Cubric Prompt.
 * This is the local replacement. Nothing here knows about recipes — the renderer
 * (`js/services/llmService.js`) resolves the recipe and sends the finished system
 * prompt, because `js/data/recipes/` is ESM the renderer already loads. This half
 * exists for one reason the renderer cannot cover: **the DeepInfra key lives in
 * the main process and must never reach the renderer.**
 *
 * The routes:
 *   GET  /llm/status          -> { deepinfra: { hasKey }, ollama: { running }, defaultBackend }
 *   GET  /llm/models          -> { models: [{ id, name, description, ollama, deepinfra, isDefault, price }] }
 *   POST /llm/enhance         -> { ok, text, backend, model } | { ok:false, error }
 *   GET  /llm/ollama          -> { running, platform, install, defaultModelId,
 *                                  models: { <id>: { name, downloaded, size, pull } } }
 *   POST /llm/ollama/start    -> { status: 'running'|'started'|'missing'|'failed' }
 *   POST /llm/ollama/install  -> { ok }   ok:false = no silent install here, open the download page
 *   POST /llm/ollama/pull     -> { ok } | { ok:false, error }   body { modelId }
 *
 * HONEST STATE IS PART OF THE CONTRACT: every completion echoes the backend and
 * the model that actually answered, never the one that was asked for. The UI
 * shows it, and "local" must never appear over a cloud answer.
 *
 * The backends themselves are `services/llmEngines.mjs` — the SAME clients the
 * Stage 1 recipe harness measures every recipe on. One implementation, so a fix
 * here cannot drift from the instrument that produced the greens. Starting,
 * installing and downloading into Ollama is `services/ollamaLifecycle.js` (MPI-728
 * phase 3), which the harness never touches.
 */

'use strict';

const express = require('express');
const router = express.Router();
const logger = require('./logger');
const { ask } = require('./forkBridge');
const ollamaLifecycle = require('../services/ollamaLifecycle');

// `services/llmEngines.mjs` is ESM and this router is CJS, so it loads through a
// dynamic import — the same thing server.js already does for axios. Cached after
// the first call.
let _enginesPromise = null;
function engines() {
    if (!_enginesPromise) _enginesPromise = import('../services/llmEngines.mjs');
    return _enginesPromise;
}

/**
 * The DeepInfra key, or null. Order: the user's stored key (main process,
 * safeStorage, over the fork bridge) then `DEEPINFRA_API_KEY` from the
 * environment — which is what a dev run and the recipe harness use. The value
 * never leaves this module: it is handed straight to the engine and is not
 * logged, cached on disk, or returned by any route.
 */
async function deepInfraKey() {
    const m = await ask('secrets:get-deepinfra-key-request', {});
    return (m && m.value) || process.env.DEEPINFRA_API_KEY || null;
}

/** Presence only — asked on every readiness poll, so it must not move the key. */
async function hasDeepInfraKey() {
    const m = await ask('secrets:has-deepinfra-key-request', {});
    if (m && typeof m.has === 'boolean') return m.has || !!process.env.DEEPINFRA_API_KEY;
    return !!process.env.DEEPINFRA_API_KEY;
}

/**
 * Which backend a request without an explicit choice runs on.
 *
 * DeepInfra when a key is present, Ollama otherwise (Fabio, 2026-09-08: with a
 * key connected there is no GPU tax on any model, which is what let the enhance
 * control collapse to one path). This resolves SERVER-side because only this
 * process can see the key — the renderer is told the answer, never the reason
 * it could compute it itself.
 */
async function defaultBackend() {
    return (await hasDeepInfraKey()) ? 'deepinfra' : 'ollama';
}

router.get('/llm/status', async (_req, res) => {
    try {
        const { OllamaEngine } = await engines();
        const [hasKey, running] = await Promise.all([
            hasDeepInfraKey(),
            new OllamaEngine().isRunning(),
        ]);
        res.json({
            deepinfra: { hasKey },
            ollama: { running },
            defaultBackend: hasKey ? 'deepinfra' : 'ollama',
        });
    } catch (err) {
        logger.error('system', `llm status failed: ${err && err.message}`);
        // A probe failure is "not ready", never a 500 the caller has to branch on.
        res.json({ deepinfra: { hasKey: false }, ollama: { running: false }, defaultBackend: 'ollama' });
    }
});

/**
 * DeepInfra's prices, kept for the life of the process once a fetch succeeds. A
 * failure is not kept, so the next panel open tries again.
 * ponytail: a mid-session reprice shows after a restart; add a TTL if that matters.
 */
let _prices = null;
async function deepInfraPrices() {
    if (!_prices) _prices = engines().then((e) => e.fetchDeepInfraPrices());
    const prices = await _prices;
    if (!prices) _prices = null;
    return prices;
}

/**
 * GET /llm/models — the enhancer LLM catalogue, for the settings picker.
 *
 * MPI-728. The registry lives in `services/llmEngines.mjs`, which is server-side
 * ESM the renderer cannot import, so the picker asks for it here. Coverage is
 * reported per backend rather than as one list, because it is ASYMMETRIC on
 * purpose — abliterated builds exist only locally — and the dropdown has to
 * filter to the backend the user picked instead
 * of offering a model that backend cannot serve.
 *
 * `price` is DeepInfra's live `{ in, out }` in USD per 1M tokens, or null. It is
 * fetched ONLY once a key is saved, so a user who never chose the cloud makes no
 * call to it, and even then no key is sent: the catalogue is public.
 */
router.get('/llm/models', async (_req, res) => {
    try {
        const { MODEL_REGISTRY, DEFAULT_MODEL_ID, modelName } = await engines();
        const prices = (await hasDeepInfraKey()) ? await deepInfraPrices() : null;
        res.json({
            defaultModelId: DEFAULT_MODEL_ID,
            models: MODEL_REGISTRY.map((m) => ({
                id: m.id,
                name: m.name,
                names: { ollama: modelName(m, 'ollama'), deepinfra: modelName(m, 'deepinfra') },
                description: m.description,
                ollama: !!m.ollamaName,
                deepinfra: !!m.deepInfraId,
                isDefault: m.id === DEFAULT_MODEL_ID,
                price: (m.deepInfraId && prices?.[m.deepInfraId]) || null,
            })),
        });
    } catch (err) {
        logger.error('system', `llm models failed: ${err && err.message}`);
        res.json({ defaultModelId: null, models: [] });
    }
});

/**
 * Download sizes from Ollama's registry, kept once known. A failure is not kept,
 * so the next look tries again.
 */
const _ollamaSizes = new Map();
async function ollamaSize(name) {
    if (_ollamaSizes.has(name)) return _ollamaSizes.get(name);
    const size = await (await engines()).ollamaDownloadSize(name);
    if (size) _ollamaSizes.set(name, size);
    return size;
}

/**
 * GET /llm/ollama — Ollama's state, for the settings row (MPI-728 phase 3).
 *
 * READ-ONLY: it never starts, installs or downloads anything, so polling it during a
 * download costs one local probe. `downloaded` is null while Ollama is not running,
 * because nothing can be known about its store then. `size` is looked up only for a
 * model that is not downloaded, from Ollama's public registry, which is where the
 * download itself would come from.
 */
router.get('/llm/ollama', async (_req, res) => {
    try {
        const { OllamaEngine, MODEL_REGISTRY, DEFAULT_MODEL_ID, ollamaTagged, modelName } = await engines();
        const engine = new OllamaEngine();
        const running = await engine.isRunning();
        const installed = running ? new Set(await engine.listModels()) : null;
        const entries = await Promise.all(MODEL_REGISTRY.filter((m) => m.ollamaName).map(async (m) => {
            const downloaded = installed ? installed.has(ollamaTagged(m.ollamaName)) : null;
            return [m.id, {
                name: modelName(m, 'ollama'),
                downloaded,
                size: downloaded === false ? await ollamaSize(m.ollamaName) : null,
                pull: ollamaLifecycle.pullState(m.ollamaName),
            }];
        }));
        res.json({
            running,
            platform: process.platform,
            install: ollamaLifecycle.installState(),
            defaultModelId: DEFAULT_MODEL_ID,
            models: Object.fromEntries(entries),
        });
    } catch (err) {
        logger.error('system', `llm ollama state failed: ${err && err.message}`);
        res.status(500).json({ error: 'Could not read the state of Ollama.' });
    }
});

/** POST /llm/ollama/start — start an installed, stopped Ollama. Never installs. */
router.post('/llm/ollama/start', async (_req, res) => {
    const status = await ollamaLifecycle.ensureOllama().catch((err) => {
        logger.error('system', `ollama start failed: ${err && err.message}`);
        return 'failed';
    });
    logger.info('system', `ollama start: ${status}`);
    res.json({ status });
});

/**
 * POST /llm/ollama/install — install Ollama silently (Windows, winget). Reached only
 * from the user's own click on "Install Ollama", which is the consent. `ok: false`
 * means this platform has no silent install: the row opens the download page.
 */
router.post('/llm/ollama/install', (_req, res) => {
    const ok = ollamaLifecycle.installOllama();
    if (ok) logger.info('system', 'ollama install started (winget)');
    res.json({ ok });
});

/**
 * POST /llm/ollama/pull — download one registry model into the user's own Ollama.
 * Reached only from the user's click on Download. Returns once the download has
 * started; its progress is on `GET /llm/ollama`.
 */
router.post('/llm/ollama/pull', async (req, res) => {
    try {
        const { getModel, DEFAULT_MODEL_ID } = await engines();
        const asked = req.body && req.body.modelId;
        const entry = getModel(asked || DEFAULT_MODEL_ID);
        if (!entry || !entry.ollamaName) {
            return res.json({ ok: false, error: `No Ollama model for id: ${asked}` });
        }
        // A download needs a server to talk to; starting one is not a download.
        const status = await ollamaLifecycle.ensureOllama();
        if (status === 'missing' || status === 'failed') {
            return res.json({ ok: false, error: 'Ollama is not running, so nothing can be downloaded into it.' });
        }
        ollamaLifecycle.startPull(entry.ollamaName);
        logger.info('system', `ollama pull started: ${entry.ollamaName}`);
        res.json({ ok: true });
    } catch (err) {
        logger.error('system', `ollama pull failed to start: ${err && err.message}`);
        res.json({ ok: false, error: (err && err.message) || 'The download could not start.' });
    }
});

/**
 * POST /llm/enhance — one completion.
 *
 * body: { prompt, system?, backend?, modelId?, maxTokens? }
 *   `backend`   'deepinfra' | 'ollama'. Omitted -> `defaultBackend()`.
 *   `modelId`   a neutral id from `MODEL_REGISTRY`. Omitted -> the registry default.
 *   `maxTokens` a positive integer cap on the reply. Omitted -> the provider's own.
 *
 * The ComfyUI backend is deliberately NOT reachable here: it runs as a queued
 * ComfyUI job through the existing `promptEnhance` operation, which the renderer
 * already knows how to dispatch. Routing it through this process would mean a
 * second dispatch path to the same engine.
 */
router.post('/llm/enhance', async (req, res) => {
    const { prompt, system, backend: asked, modelId, maxTokens: askedMax } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.json({ ok: false, error: 'Write a prompt first, then Enhance.' });
    }

    let backend;
    try {
        const { OllamaEngine, DeepInfraEngine, getModel, DEFAULT_MODEL_ID, ollamaTagged, modelName } = await engines();
        backend = asked === 'deepinfra' || asked === 'ollama' ? asked : await defaultBackend();

        const entry = getModel(modelId || DEFAULT_MODEL_ID);
        if (!entry) return res.json({ ok: false, error: `Unknown model id: ${modelId}` });
        // Backend coverage is asymmetric ON PURPOSE — abliterated builds exist
        // only locally — so a valid id can
        // still be unreachable on the chosen backend. Say which, rather than
        // letting `model: undefined` reach the wire.
        const model = backend === 'deepinfra' ? entry.deepInfraId : entry.ollamaName;
        if (!model) return res.json({ ok: false, error: `"${entry.name}" has no ${backend} variant.` });
        const name = modelName(entry, backend);

        if (backend === 'ollama') {
            // MPI-728 phase 3: a stopped Ollama is STARTED here, not reported. Starting
            // an app the user already installed asks nothing of them (Cubric Prompt's
            // MPI-8 ruling). Installing it, or downloading a multi-GB model, never
            // happens from an enhance: both are the user's own click in the settings.
            const status = await ollamaLifecycle.ensureOllama();
            if (status === 'missing') {
                return res.json({ ok: false, error: 'Ollama is not installed. Install it in Remote → Language Models, or pick another backend there.' });
            }
            if (status === 'failed') {
                return res.json({ ok: false, error: 'Ollama is installed but did not start. Start it yourself, or pick another backend in Remote → Language Models.' });
            }
            // Without this the user gets Ollama's own `404 Not Found`, which names nothing.
            if (!(await new OllamaEngine().listModels()).includes(ollamaTagged(model))) {
                return res.json({ ok: false, error: `${name} is not downloaded in Ollama yet. Download it in Remote → Language Models.` });
            }
        }

        const engine = backend === 'deepinfra'
            ? new DeepInfraEngine(await deepInfraKey())
            : new OllamaEngine();
        // A flow's token cap travels here (`Input_Text_Gen.max_length`, MPI-677): Music
        // Maker's 800 guards against a measured runaway repetition loop. Anything that
        // is not a positive integer is no cap, never a zero-length reply.
        const maxTokens = Number.isInteger(askedMax) && askedMax > 0 ? askedMax : undefined;
        const result = await engine.complete(prompt, { model, system, maxTokens });

        // `result.backend` / `result.model`, not the variables above: the engine
        // reports what actually answered.
        res.json({
            ok: true,
            text: String(result.text || '').trim(),
            backend: result.backend,
            model: result.model,
        });
    } catch (err) {
        logger.error('system', `llm enhance failed: ${err && err.message}`);
        res.json({ ok: false, error: (err && err.message) || 'Enhance failed.' });
    } finally {
        // MPI-14's rule, now on Vision's side of it: a local LLM must not sit on
        // VRAM the generator is about to want. Measured on a 16GB card — an idle
        // LLM alongside a video generation took a sub-10s render past 3 minutes,
        // because once VRAM is exhausted every token crosses PCIe. `keep_alive:0`
        // on EVERY exit path, failures included. The cloud backend holds no local
        // VRAM, so `releaseLocalModels` is a no-op there.
        if (backend === 'ollama') {
            try {
                const { OllamaEngine } = await engines();
                await new OllamaEngine().releaseOwnModels();
            } catch { /* server gone / already empty — nothing was held either way */ }
        }
    }
});

module.exports = router;
module.exports.defaultBackend = defaultBackend;
