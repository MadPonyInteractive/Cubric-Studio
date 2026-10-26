'use strict';

/**
 * routes/phone.js — the phone companion page (MPI-1300).
 *
 *   GET /phone — phone.html, the phone's own entry (js/phone/init.js), no desktop shell.
 *
 * Dev-gated until every phase of MPI-1300 lands: on a release build both /phone and
 * /phone.html answer 404. Registered BEFORE express.static in server.js, or the static
 * server would hand out phone.html past the gate.
 */

const path = require('path');
const express = require('express');
const { devMode } = require('./devMode');

const router = express.Router();
const PAGE = path.join(__dirname, '..', 'phone.html');

router.get(['/phone', '/phone.html'], (req, res) => {
    if (!devMode()) return res.status(404).end();
    res.sendFile(PAGE);
});

module.exports = router;
