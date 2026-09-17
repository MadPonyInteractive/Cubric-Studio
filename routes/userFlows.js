'use strict';

/**
 * routes/userFlows.js — Flow packages from `<userData>/user_flows/` (MPI-532).
 *
 * Routes exposed:
 *   GET /user-flows                                    → { flows: [{ id, manifest, errors }] }
 *   POST /user-flows/install                           → install a dropped folder or .zip
 *   GET /comfy_workflows/user-flows/:id/:file          → a package file (its workflow.json)
 *   GET /comfy_workflows/display/user-flows/:id/:file  → a package file (its preview media)
 *
 * The two file routes sit UNDER the paths the app already fetches by name — graphs from
 * `/comfy_workflows/<file>`, previews from `comfy_workflows/display/<file>` — so a package
 * FlowDef that names `user-flows/<id>/workflow.json` needs no change at any fetch site.
 * routes/workflowStatic.js passes nested paths through, and nothing under the app's own
 * comfy_workflows/ is called user-flows, so express.static falls through to here.
 *
 * Invalid packages are listed too, with their errors: the Library shows them disabled with
 * the reason named, because silence reads as a broken app.
 */

const path = require('path');
const express = require('express');
const logger = require('./logger');
const { scanUserFlows, installPackage, packageFilePath } = require('../services/userFlows');

const router = express.Router();

router.get('/user-flows', (req, res) => {
    try {
        const flows = scanUserFlows();
        for (const f of flows) {
            if (f.errors.length) logger.warn('userFlows', `${f.id}: ${f.errors.join(' | ')}`);
        }
        logger.info('userFlows', `${flows.length} package(s), ${flows.filter(f => !f.errors.length).length} valid`);
        res.json({ flows });
    } catch (err) {
        logger.error('userFlows', `scan failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// { path, overwrite } → 200 { status: 'installed', entry } | { status: 'exists', id, title }
// | { status: 'invalid', errors }. All three are ANSWERS, so all are 200 — a 4xx would put
// "Failed to load resource" in the renderer console for a user's ordinary second drop.
router.post('/user-flows/install', async (req, res) => {
    const { path: src, overwrite = false } = req.body || {};
    if (typeof src !== 'string' || !path.isAbsolute(src)) {
        return res.status(400).json({ error: 'path must be an absolute path' });
    }
    try {
        const result = await installPackage(src, { overwrite: overwrite === true });
        logger.info('userFlows', `install ${src} → ${result.status}${result.errors ? `: ${result.errors.join(' | ')}` : ''}`);
        res.json(result);
    } catch (err) {
        logger.error('userFlows', `install ${src} failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.get(['/comfy_workflows/user-flows/:id/:file', '/comfy_workflows/display/user-flows/:id/:file'], (req, res) => {
    const abs = packageFilePath(req.params.id, req.params.file);
    if (!abs) return res.sendStatus(404);
    res.sendFile(abs, (err) => {
        if (err && !res.headersSent) res.sendStatus(err.statusCode || 404);
    });
});

module.exports = router;
