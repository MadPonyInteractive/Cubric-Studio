'use strict';

// MPI-1076 — a toast is true when it fires, fires when the thing happens, and says
// nothing another surface already says. Four that broke all of that on one morning
// (Fabio, 2026-10-11, live on a RunPod session). SOURCE-READ: these modules reach the
// DOM, ipcRenderer and the component factory, so they do not import in bare Node.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')
    .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');

test('only a finished connect announces the Pod, once', () => {
    // A 100 s LoRA upload starved /health, the feed dropped the Pod to local and back,
    // and the rising-edge latch said "<GPU> connected." with no connect pressed.
    const ns = read('js/shell/notificationService.js');
    assert.match(ns, /if \(connected !== true \|\| !announce\) return;/,
        'REGRESSION: notificationService announces a connection the feed inferred');
    assert.ok(!/_wasRemoteConnected/.test(ns), 'REGRESSION: the rising-edge latch is back');

    const settings = read('js/components/Organisms/MpiRunpodSettings/MpiRunpodSettings.js');
    const shell = read('js/shell.js');
    assert.match(settings, /connected: true, \.\.\._specs, phase: null, announce: true/);
    assert.match(shell, /connected: true, \.\.\.specs, phase: null, announce: true/);
    // The flows' own "Remote engine ready" toast doubled it.
    for (const [name, src] of [['MpiRunpodSettings', settings], ['shell', shell]]) {
        assert.ok(!/(notify|ui:success)[^\n]*Remote engine ready/.test(src),
            `REGRESSION: ${name} toasts "Remote engine ready" itself - the connect is announced twice`);
    }
});

test('the feed holds a connected Pod through an upload, like a download', () => {
    const shell = read('js/shell.js');
    assert.match(shell, /const suppress = _activeDownloads\.size > 0 \|\| uploading \|\| _misses < MISS_THRESHOLD;/,
        'REGRESSION: an upload can drop the hero to local and re-run the connect edge');
});

test('a generate-time upload is not announced twice', () => {
    assert.ok(!/ui:info[^\n]*to the cloud/.test(read('js/services/comfyController.js')),
        'REGRESSION: the generate-time upload toast is back - its Transfers row already shows it');
    assert.match(read('routes/remoteUploads.js'), /status: 'queued', error: null, atGenerate: true/);
    assert.match(read('js/services/downloadService.js'), /atGenerate: j\.atGenerate === true/);
    assert.match(read('js/shell/notificationService.js'), /if \(atGenerate\) return;/);
});

test('uninstall says "uninstalled" only when something went', () => {
    // Re-run the decision the Model Library makes, on the 2026-10-11 Wan 2.2 case:
    // its own files absent, everything left held by a plugin and the engine.
    const src = read('js/components/Organisms/MpiModelManager/MpiModelManager.js');
    const m = src.match(/const gone = ([^;]+);/);
    assert.ok(m, 'uninstall toast: the `gone` decision moved - update this test');
    const gone = new Function('removed', 'keptTotal', 'absent', `return ${m[1]};`);

    assert.equal(gone([], 2, 3), 0, 'removed 0 with files kept is a no-op, not "uninstalled"');
    assert.equal(gone([], 0, 3), 3, 'every file already gone and none kept: the uninstall is complete');
    assert.equal(gone([{}, {}], 1, 1), 3, 'something deleted: it counts, absent ones too');
});
