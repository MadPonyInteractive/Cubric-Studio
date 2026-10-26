'use strict';

/**
 * routes/phone.js — the phone companion (MPI-1300).
 *
 *   GET /phone              — phone.html, the phone's own entry (js/phone/init.js), no desktop shell.
 *   GET /phone/agent-prefs  — { ok, output: { profileId, model, mode } }: what the PC's chat sends
 *                             with, relayed from the window (`agent.prefs`). Errors: APP_UNAVAILABLE.
 *   GET /phone/cards?folderPath=&kind=&offset=&limit=
 *                           — { ok, cards, total, counts: { all, image, video } }, newest first;
 *                             `kind` (image | video) filters before paging, `total` counts what it kept.
 *                             Every version of a card, with its file and thumbs, for the gallery
 *                             and the viewer. Errors: BAD_REQUEST (400), NOT_A_PROJECT.
 *
 * Dev-gated until every phase of MPI-1300 lands: on a release build all of these answer 404.
 * Registered BEFORE express.static in server.js, or the static server would hand out
 * phone.html past the gate.
 */

const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const { devMode } = require('./devMode');
const { dispatchToRenderer } = require('./connector');

const router = express.Router();
const PAGE = path.join(__dirname, '..', 'phone.html');
const CARDS_DEFAULT = 40;
const CARDS_MAX = 100;

router.use(['/phone', '/phone.html'], (req, res, next) => (devMode() ? next() : res.status(404).end()));

router.get(['/phone', '/phone.html'], (_req, res) => res.sendFile(PAGE));

router.get('/phone/agent-prefs', async (_req, res) => res.json(await dispatchToRenderer('agent.prefs', {})));

async function _readJson(file) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

/** One version's sidecar, as the phone draws it. Null when the sidecar is gone. */
async function _version(folderPath, itemId) {
    if (typeof itemId !== 'string' || !/^[\w-]+$/.test(itemId)) return null;
    const meta = await _readJson(path.join(folderPath, 'Media', '.meta', `${itemId}.json`));
    if (!meta?.filePath) return null;
    return {
        itemId,
        type: meta.type,
        url: meta.filePath,
        thumb: meta.thumbPath || null,
        thumbLg: meta.thumbPathLg || null,
        prompt: meta.prompt || '',
        modelId: meta.modelId || null,
        operation: meta.operation || null,
        flowId: meta.flowId || null,
        size: meta.pixelDimensions || null,
        duration: meta.duration || null,
    };
}

router.get('/phone/cards', async (req, res) => {
    const { folderPath } = req.query;
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'folderPath must be an absolute path.' } });
    }
    const project = await _readJson(path.join(folderPath, 'project.json'));
    if (!project) {
        return res.json({ ok: false, error: { code: 'NOT_A_PROJECT', message: `No Cubric Studio project at ${folderPath}.` } });
    }
    // A stack's members show as cards of their own: the phone has no stack view.
    const groups = (Array.isArray(project.itemGroups) ? project.itemGroups : [])
        .filter((g) => g && typeof g.id === 'string' && g.archived !== true && g.type !== 'stack')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const kind = req.query.kind;
    const listed = kind ? groups.filter((g) => g.type === kind) : groups;
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || CARDS_DEFAULT, 1), CARDS_MAX);
    const cards = await Promise.all(listed.slice(offset, offset + limit).map(async (g) => {
        const history = Array.isArray(g.history) ? g.history : [];
        const versions = (await Promise.all(history.map((id) => _version(folderPath, id)))).filter(Boolean);
        const shown = history[g.selectedIndex ?? 0];
        const selected = Math.max(versions.findIndex((v) => v.itemId === shown), 0);
        return { groupId: g.id, name: g.customName || g.name, kind: g.type, createdAt: g.createdAt, selected, versions };
    }));
    const count = (kind) => groups.filter((g) => g.type === kind).length;
    res.json({
        ok: true,
        cards: cards.filter((c) => c.versions.length),
        total: listed.length,
        counts: { all: groups.length, image: count('image'), video: count('video') },
    });
});

module.exports = router;
