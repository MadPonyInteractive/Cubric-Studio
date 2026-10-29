'use strict';

// MPI-1112 — a LOCAL ComfyUI crash was reported as a remote Pod drop.
//
// _onWsDropped (MPI-563/B4) was written for a Pod OOM, so it always said "the Pod
// may have run out of memory" and always emitted `remote:engine-dropped`, which
// flips the remote connection to `disconnected`. A local engine that crashed
// mid-generation (Qwen3-ASR access violation, 2026-10-12) got both Pod toasts.
// comfyController.js does not import into bare Node, hence read-and-assert.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/services/comfyController.js'), 'utf8');
const dropped = SRC.slice(SRC.indexOf('_onWsDropped() {'));
const body = dropped.slice(0, dropped.indexOf('\n    },'));

test('the dying socket\'s engine is captured on the FIRST failed reopen', () => {
    assert.match(SRC, /if \(this\._wsReconnectAttempts === 0\) this\._droppedEngine = this\._engine;/);
});

test('remote:engine-dropped is emitted only for a remote socket', () => {
    assert.match(body, /const remote = this\._droppedEngine === 'remote';/);
    const EMIT = /if \(remote\) Events\.emit\('remote:engine-dropped'[^;]*\);/;
    assert.match(body, EMIT);
    assert.doesNotMatch(body.replace(EMIT, ''), /remote:engine-dropped/);
});

test('the local message names no Pod', () => {
    const local = body.slice(body.indexOf(': \'The local engine'), body.indexOf(');', body.indexOf(': \'The local engine')));
    assert.ok(local.length > 0, 'local message missing');
    assert.doesNotMatch(local, /Pod|Remote|out of memory/);
});
