/**
 * autostart-comfy-default.test.cjs — MPI-863.
 *
 * "Auto-start ComfyUI on launch" defaults ON once a local engine is installed. The pref
 * is a sync localStorage boolean, so the DEFAULT cannot ask the engine — `_bootApp` seeds
 * it once from /engine/version-check, and `Storage.hasAutoStartComfy()` is what lets it
 * tell "never set" apart from a user's explicit off.
 *
 * What fails silently without this: `hasAutoStartComfy` returning true for an unset key
 * (seed never runs, default stays off forever), or returning false for a stored `false`
 * (every boot re-seeds the pref back ON and the Settings switch will not stay off).
 *
 * The seed itself is renderer boot code; its two rules are pinned against the source
 * because they are one-way and easy to "tidy" into a two-way write.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function installLocalStorageStub() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
    return store;
}

test('hasAutoStartComfy separates "never set" from an explicit false', async () => {
    installLocalStorageStub();
    const { Storage } = await import('../js/core/storage.js');

    assert.strictEqual(Storage.hasAutoStartComfy(), false, 'a fresh store must read as unset, or boot never seeds');
    assert.strictEqual(Storage.getAutoStartComfy(), false, 'unset must still READ as off — there may be no engine');

    Storage.setAutoStartComfy(false);
    assert.strictEqual(
        Storage.hasAutoStartComfy(), true,
        'an explicit off must read as SET, or every boot re-seeds it back on'
    );
    assert.strictEqual(Storage.getAutoStartComfy(), false);

    Storage.setAutoStartComfy(true);
    assert.strictEqual(Storage.hasAutoStartComfy(), true);
    assert.strictEqual(Storage.getAutoStartComfy(), true);
});

test('the boot seed is one-way and gated on the unset state', () => {
    const shell = fs.readFileSync(path.join(__dirname, '..', 'js', 'shell.js'), 'utf8');
    // Three gates, not two (MPI-797 added the third, 2026-09-21): a set pref, a remote
    // auto-connect boot, and the E2E harness. A spec profile is always fresh, so this seed
    // always ran there — and on a dev box that HAS an engine it turned auto-start ON, boot
    // tried to start ComfyUI inside the harness, and the failure modal's backdrop swallowed
    // every click for the rest of the run. The suite is engine-blind by design (MPI-446).
    const seed = shell.match(/if \(!runpodCfg\.autoConnectOnStart && !Storage\.hasAutoStartComfy\(\) && !_isE2E\(\)\) \{[\s\S]*?\n  \}/);
    assert.ok(seed, 'the auto-start seed block is gone or its gate changed — it must skip a set pref, a remote auto-connect boot AND the E2E harness');

    const body = seed[0];
    assert.ok(
        /needsInstall !== true\) Storage\.setAutoStartComfy\(true\)/.test(body),
        'the seed must turn the pref ON only when an engine is installed'
    );
    assert.ok(
        !/setAutoStartComfy\((?!true\))/.test(body),
        'the seed must never write a false — that freezes "no engine yet" in permanently'
    );

    // The seed has to sit after the install gate, or it reads the needsInstall the user
    // booted with rather than the engine they just installed.
    assert.ok(
        shell.indexOf("_engineInstall.el.show('installing')") < shell.indexOf('!Storage.hasAutoStartComfy()'),
        'the seed must run AFTER the engine install gate'
    );
});
