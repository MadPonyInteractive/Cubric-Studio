'use strict';

// MPI-823 — every "Copied on reuse" part in Settings must survive an app restart.
//
// `normalizePromptReuseOptions` runs on the WRITE as well as the read, so a part the
// Settings grid offers but the normalizer does not list is stripped on its way to
// localStorage and reads back as ON next launch. `video` and `audio` shipped that way
// (MPI-227 added them to the UI, not to the store): unticking either held for the rest
// of the session, because `state.promptReuseOptions` keeps the full object in memory,
// and reverted silently on restart.
//
// The part list is read out of MpiSettings' own `REUSE_PARTS` rather than repeated
// here, so adding an eighth part without teaching the store about it fails this test.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SETTINGS_SRC = path.join(
    __dirname, '..', 'js', 'components', 'Compounds', 'LandingPages', 'MpiSettings', 'MpiSettings.js',
);

/** The `key:` values inside MpiSettings' `const REUSE_PARTS = [ … ];` */
function settingsReuseParts() {
    const src = fs.readFileSync(SETTINGS_SRC, 'utf8');
    const block = src.match(/const REUSE_PARTS = \[([\s\S]*?)\];/);
    assert.ok(block, 'REUSE_PARTS not found in MpiSettings.js — did it move or get renamed?');
    const keys = [...block[1].matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
    assert.ok(keys.length >= 6, `expected the reuse parts, got ${JSON.stringify(keys)}`);
    return keys;
}

/** A fresh in-memory localStorage, installed globally for js/core/storage.js. */
function stubStorage() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    return store;
}

test('every Settings reuse part survives a restart', async () => {
    const store = stubStorage();
    const { Storage } = await import('../js/core/storage.js');
    const parts = settingsReuseParts();

    // What Settings writes when the user unticks one part.
    for (const off of parts) {
        const picked = { ask: false };
        for (const key of parts) picked[key] = key !== off;
        Storage.setPromptReuseOptions(picked);

        // The restart: only what reached localStorage comes back.
        const raw = JSON.parse(store.get('mpi_prompt_reuse_options'));
        assert.equal(raw[off], false, `"${off}" never reached localStorage`);

        const after = Storage.getPromptReuseOptions();
        assert.equal(after[off], false, `"${off}" reverted to ON across a restart`);
        for (const key of parts) {
            if (key !== off) assert.equal(after[key], true, `"${key}" was lost while unticking "${off}"`);
        }
    }
});

test('a fresh store reads every part as ON, and ask defaults ON', async () => {
    stubStorage();
    const { Storage } = await import('../js/core/storage.js');

    const fresh = Storage.getPromptReuseOptions();
    assert.equal(fresh.ask, true, 'ask must default ON — Reuse Prompt opens the picker');
    for (const key of settingsReuseParts()) {
        assert.equal(fresh[key], true, `"${key}" should default ON on a fresh store`);
    }
});
