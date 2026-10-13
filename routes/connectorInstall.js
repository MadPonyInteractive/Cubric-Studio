'use strict';

/**
 * routes/connectorInstall.js — MPI-1126: the installs `POST /connector/install` (models) does
 * not cover, for an outside agent over MCP. Same renderer channel as routes/connectorGif.js.
 *
 *   POST /connector/install-flow   { flowId, start? } -> { flowId, title, downloadGb, started, licence? }
 *     Without `start` it only answers the size, so the caller can ask the user first.
 *     Errors: BAD_REQUEST, UNKNOWN_FLOW, UNAVAILABLE, ALREADY_INSTALLED, NO_ENGINE, OFFLINE,
 *     APP_UNAVAILABLE.
 *   POST /connector/install-engine { modelsRoot? } -> { started: true }
 *     A FIRST local ComfyUI install, run through the app's own install screen.
 *     Errors: ALREADY_INSTALLED, OFFLINE, APP_UNAVAILABLE.
 *
 * The confirm lives in the caller (routes/mcp.js `askDownload`), as the spend gate does.
 */

const express = require('express');
const router = express.Router();
const logger = require('./logger');
const { dispatchToRenderer } = require('./connector');
const { checkOnline } = require('./netCheck');

const OFFLINE = { ok: false, error: { code: 'OFFLINE', message: 'The host appears to be offline.' } };

async function _run(res, capability, input) {
  const result = await dispatchToRenderer(capability, input);
  if (!result.ok) logger.warn('connector', `${capability} failed: ${result.error?.code} ${result.error?.message}`);
  // The renderer answers { ok, output }; flatten one level, as /connector/install does.
  res.json(result.ok && result.output ? { ok: true, ...result.output } : result);
}

router.post('/connector/install-flow', async (req, res) => {
  const { flowId, start } = req.body || {};
  if (typeof flowId !== 'string' || !flowId) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'body.flowId is required.' } });
  }
  if (start && !(await checkOnline())) return res.json(OFFLINE);
  return _run(res, 'agent.install-flow', { flowId, start: start === true });
});

router.post('/connector/install-engine', async (req, res) => {
  const { modelsRoot } = req.body || {};
  if (!(await checkOnline())) return res.json(OFFLINE);
  return _run(res, 'agent.install-engine', { modelsRoot: typeof modelsRoot === 'string' ? modelsRoot : '' });
});

module.exports = router;
