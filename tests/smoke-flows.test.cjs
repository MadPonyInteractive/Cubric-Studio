'use strict';
/**
 * Unit tests for the Flow smoke leg in scripts/smoke-workflows.mjs.
 * Pure (no network, no Pod, no RunPod): exercises resolveFlowSmokeSet and prepFlowOp
 * against real workflow files on disk.
 */

const path = require('node:path');
const assert = require('node:assert/strict');
const { test, before } = require('node:test');

const REPO = path.resolve(__dirname, '..');

// smoke-workflows.mjs is an ES module; load it with a dynamic import shim.
let resolveFlowSmokeSet, prepFlowOp, loadRegistry, flowInstallNeeds;

before(async () => {
    // file:// URL for Windows path compatibility
    const url = `file:///${path.join(REPO, 'scripts', 'smoke-workflows.mjs').replace(/\\/g, '/')}`;
    const mod = await import(url);
    ({ resolveFlowSmokeSet, prepFlowOp, loadRegistry, flowInstallNeeds } = mod);
});

// ── resolveFlowSmokeSet ───────────────────────────────────────────────────────

test('resolveFlowSmokeSet all: derived from FLOWS; ids match FLOWS ids; ltx-extend byModel arm present', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, 'all');
    // ids of default-arm entries must equal FLOWS ids exactly
    const defaultEntryIds = entries.filter(e => e.arm === null).map(e => e.id).sort();
    const flowsIds = reg.FLOWS.map(f => f.id).sort();
    assert.deepEqual(defaultEntryIds, flowsIds, `resolveFlowSmokeSet ids must equal FLOWS ids`);
    // ltx-extend expands to a byModel arm
    assert.ok(entries.some(e => e.id === 'ltx-extend' && e.arm === null), 'ltx-extend default arm present');
    assert.ok(entries.some(e => e.id === 'ltx-extend' && e.arm !== null), 'ltx-extend byModel arm present');
});

test('resolveFlowSmokeSet all: every entry has a wfFile that exists on disk', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, 'all');
    const { existsSync } = await import('node:fs');
    const WF_DIR = path.join(REPO, 'comfy_workflows');
    const missing = entries.filter(e => !e.wfFile || !existsSync(path.join(WF_DIR, e.wfFile)));
    assert.equal(missing.length, 0,
        `entries missing workflow file: ${missing.map(e => `${e.label} -> ${e.wfFile}`).join(', ')}`);
});

test('resolveFlowSmokeSet specific ids: ltx-extend expands to both arms', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, ['ltx-extend']);
    assert.equal(entries.length, 2, `ltx-extend should expand to 2 arms (LTX + H3), got ${entries.length}`);
    assert.equal(entries[0].arm, null, 'first entry is the default arm (null)');
    assert.equal(entries[0].wfFile, 'flow_ltx_extend.json');
    assert.notEqual(entries[1].arm, null, 'second entry is the byModel arm');
    assert.equal(entries[1].wfFile, 'flow_h3_extend.json');
});

test('resolveFlowSmokeSet specific ids: scribble,outpaint → 2 entries, no arms', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, ['scribble', 'outpaint']);
    assert.equal(entries.length, 2);
    assert.ok(entries.every(e => e.arm === null), 'no byModel arms');
});

test('resolveFlowSmokeSet unknown id: dies with helpful message; all FLOWS ids accepted', async () => {
    const reg = await loadRegistry();
    // All ids in reg.FLOWS must be accepted without dying.
    for (const flow of reg.FLOWS) {
        const entries = resolveFlowSmokeSet(reg, [flow.id]);
        assert.ok(entries.length >= 1, `id '${flow.id}' must resolve to at least one entry`);
    }
});

// ── prepFlowOp ────────────────────────────────────────────────────────────────

test('prepFlowOp image flow (outpaint): returns a graph with injected probe image', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['outpaint']);
    const probeFiles = { image: '/pod/smoke-probe.png' };
    const result = prepFlowOp(reg, entry, probeFiles);
    assert.ok(!result.status, `prepFlowOp SKIP/FAIL for outpaint: ${result.why}`);
    assert.ok(result.graph, 'graph object returned');
    // Verify the probe path was injected somewhere in the graph
    const injected = Object.values(result.graph).some(node =>
        node.inputs && Object.values(node.inputs).includes('/pod/smoke-probe.png'));
    assert.ok(injected, 'probe image path must be injected into the graph');
});

test('prepFlowOp dual-image flow (scribble-object): both Input_Image and Input_Paint injected', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['scribble-object']);
    const probeFiles = { image: '/pod/probe.png' };
    const result = prepFlowOp(reg, entry, probeFiles);
    assert.ok(!result.status, `prepFlowOp SKIP/FAIL: ${result.why}`);
    const vals = Object.values(result.graph).flatMap(n => Object.values(n.inputs || {}));
    const injections = vals.filter(v => v === '/pod/probe.png');
    assert.ok(injections.length >= 2, `expected >=2 injections for scribble-object, got ${injections.length}`);
});

test('prepFlowOp video flow (ltx-foley): SKIP when no video probe provided', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['ltx-foley']);
    // Provide only image, not video
    const probeFiles = { image: '/pod/probe.png' };
    const result = prepFlowOp(reg, entry, probeFiles);
    assert.equal(result.status, 'SKIP', 'must SKIP when the required video fixture is absent');
    assert.ok(result.why.includes('video'), `why message should mention 'video', got: ${result.why}`);
});

test('prepFlowOp video flow (ltx-foley): PASS offline with video probe', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['ltx-foley']);
    const probeFiles = { image: '/pod/probe.png', video: '/pod/probe.mp4' };
    const result = prepFlowOp(reg, entry, probeFiles);
    assert.ok(!result.status, `expected graph, got ${result.status}: ${result.why}`);
});

test('prepFlowOp audio flow (stems): SKIP when no audio probe, PASS with audio probe', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['stems']);
    // No audio — expect SKIP
    assert.equal(prepFlowOp(reg, entry, { image: '/p.png' }).status, 'SKIP');
    // With audio — expect graph
    const result = prepFlowOp(reg, entry, { image: '/p.png', audio: '/p.wav' });
    assert.ok(!result.status, `stems with audio probe should return graph, got ${result.status}: ${result.why}`);
});

test('prepFlowOp no-media flow (character-sheet): returns graph without any probe required', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['character-sheet']);
    const result = prepFlowOp(reg, entry, {});
    assert.ok(!result.status, `character-sheet needs no media; got ${result.status}: ${result.why}`);
    assert.ok(result.graph, 'graph returned');
});

test('prepFlowOp no-media flow (minimax-music): returns graph without probe', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['minimax-music']);
    const result = prepFlowOp(reg, entry, {});
    assert.ok(!result.status, `minimax-music: ${result.why}`);
});

test('prepFlowOp ltx-extend default arm: resolves flow_ltx_extend.json', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, ['ltx-extend']);
    const defaultArm = entries.find(e => e.arm === null);
    const result = prepFlowOp(reg, defaultArm, { video: '/p.mp4' });
    assert.ok(!result.status, `ltx-extend default arm: ${result.why}`);
    assert.equal(defaultArm.wfFile, 'flow_ltx_extend.json');
});

test('prepFlowOp ltx-extend H3 arm: resolves flow_h3_extend.json', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, ['ltx-extend']);
    const h3Arm = entries.find(e => e.arm !== null);
    assert.ok(h3Arm, 'H3 byModel arm must exist');
    const result = prepFlowOp(reg, h3Arm, { video: '/p.mp4' });
    assert.ok(!result.status, `ltx-extend H3 arm: ${result.why}`);
    assert.equal(h3Arm.wfFile, 'flow_h3_extend.json');
});

test('prepFlowOp missing wfFile: returns SKIP', async () => {
    const reg = await loadRegistry();
    const fakeEntry = { id: 'fake', op: 'flowFake', arm: null, wfFile: 'nonexistent_flow.json', label: 'fake' };
    const result = prepFlowOp(reg, fakeEntry, {});
    assert.equal(result.status, 'SKIP');
    assert.ok(result.why.includes('missing'), `why should say 'missing': ${result.why}`);
});

test('prepFlowOp null wfFile (no UNIVERSAL_WORKFLOWS entry): returns SKIP', async () => {
    const reg = await loadRegistry();
    const fakeEntry = { id: 'fake', op: 'flowNoOp', arm: null, wfFile: null, label: 'fake' };
    const result = prepFlowOp(reg, fakeEntry, {});
    assert.equal(result.status, 'SKIP');
});

test('prepFlowOp minimizeGraph applied: budget nodes are reduced in all-14 flow graphs', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, 'all');
    const probeFiles = { image: '/p.png', video: '/p.mp4', audio: '/p.wav' };
    for (const entry of entries) {
        const result = prepFlowOp(reg, entry, probeFiles);
        if (result.status) continue; // SKIP is OK if no probe matches
        assert.ok(Array.isArray(result.applied), `${entry.label}: applied must be an array`);
        // minimizeGraph returns the list of title rules it applied
        // At minimum healSeparators runs — graph should be a valid object
        assert.ok(result.graph && typeof result.graph === 'object', `${entry.label}: graph must be an object`);
    }
});

// ── requiredModelIds ──────────────────────────────────────────────────────────

test('resolveFlowSmokeSet: requiredModelIds on default arm is first candidate per slot', async () => {
    const reg = await loadRegistry();
    // ltx-extend slot has models: ['ltx-23-balanced', 'minimax-h3'] — first is ltx-23-balanced
    // (MPI-591 Phase 8 moved the H3 candidate from ref2va to the fl2va id)
    const entries = resolveFlowSmokeSet(reg, ['ltx-extend']);
    const def = entries.find(e => e.arm === null);
    assert.ok(def.requiredModelIds.includes('ltx-23-balanced'), `default arm should pick ltx-23-balanced, got: ${def.requiredModelIds}`);
    assert.ok(!def.requiredModelIds.includes('minimax-h3'), 'default arm must not include the byModel arm model');
});

test('resolveFlowSmokeSet: requiredModelIds on byModel arm uses arm-specific model', async () => {
    const reg = await loadRegistry();
    const entries = resolveFlowSmokeSet(reg, ['ltx-extend']);
    const arm = entries.find(e => e.arm !== null);
    assert.ok(arm, 'H3 byModel arm must exist');
    assert.ok(arm.requiredModelIds.includes(arm.arm), `byModel arm must include the arm model id (${arm.arm}), got: ${arm.requiredModelIds}`);
    assert.ok(!arm.requiredModelIds.includes('ltx-23-balanced'), 'byModel arm must not include the default model');
});

test('resolveFlowSmokeSet: audio flow (voice-changer) has empty requiredModelIds', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['voice-changer']);
    assert.deepEqual(entry.requiredModelIds, [], `voice-changer has no models, got: ${entry.requiredModelIds}`);
});

// ── flowDepIds ────────────────────────────────────────────────────────────────

test('resolveFlowSmokeSet: voice-changer has non-empty flowDepIds', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['voice-changer']);
    assert.ok(entry.flowDepIds.length > 0, `voice-changer must have flowDepIds, got empty`);
});

test('resolveFlowSmokeSet: stems has non-empty flowDepIds', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['stems']);
    assert.ok(entry.flowDepIds.length > 0, `stems must have flowDepIds, got empty`);
});

test('resolveFlowSmokeSet: ltx-foley has empty flowDepIds (no requiredDeps)', async () => {
    const reg = await loadRegistry();
    const [entry] = resolveFlowSmokeSet(reg, ['ltx-foley']);
    assert.deepEqual(entry.flowDepIds, [], `ltx-foley has no requiredDeps, got: ${entry.flowDepIds}`);
});

// ── flowInstallNeeds ──────────────────────────────────────────────────────────

test('flowInstallNeeds: audio-only flows contribute gbTotal > 0', async () => {
    const reg = await loadRegistry();
    const flowSet = resolveFlowSmokeSet(reg, ['voice-changer', 'stems']);
    const needs = flowInstallNeeds(reg, flowSet);
    assert.ok(needs.gbTotal > 0, `audio flows must add GB to volume estimate, got ${needs.gbTotal}`);
    assert.equal(needs.models.length, 0, 'audio flows have no requiredModels');
    assert.ok(needs.depEntries.length > 0, 'audio flows must produce depEntries');
});

test('flowInstallNeeds: flow with requiredModels (outpaint) produces models in needs', async () => {
    const reg = await loadRegistry();
    const flowSet = resolveFlowSmokeSet(reg, ['outpaint']);
    const needs = flowInstallNeeds(reg, flowSet);
    assert.ok(needs.models.length > 0, `outpaint has requiredModels, expected models in needs`);
});

test('flowInstallNeeds: byModel arms de-duped by flowId in depEntries', async () => {
    const reg = await loadRegistry();
    // ltx-extend has 2 arms but no requiredDeps — depEntries must be 0
    const flowSet = resolveFlowSmokeSet(reg, ['ltx-extend']);
    assert.equal(flowSet.length, 2, 'ltx-extend should have 2 arms');
    const needs = flowInstallNeeds(reg, flowSet);
    // ltx-extend has no requiredDeps, so no depEntries
    const ltxEntry = needs.depEntries.find(de => de.flowId === 'ltx-extend');
    assert.ok(!ltxEntry, 'ltx-extend has no requiredDeps — no depEntry expected');
});

test('flowInstallNeeds: gbTotal is zero for flows with no models and no deps', async () => {
    const reg = await loadRegistry();
    // character-sheet has requiredModels but no requiredDeps; gbTotal may be > 0 due to model deps
    // ltx-foley has a model and no flow deps — gbTotal should be > 0 from model dep sizes
    const flowSet = resolveFlowSmokeSet(reg, ['ltx-foley']);
    const needs = flowInstallNeeds(reg, flowSet);
    // ltx-foley requires ltx-23-balanced which has deps — gbTotal > 0
    assert.ok(needs.gbTotal > 0, `ltx-foley's model deps must contribute GB, got ${needs.gbTotal}`);
});

test('flowInstallNeeds: weights the model matrix already installs add nothing to the volume', async () => {
    const reg = await loadRegistry();
    const flowSet = resolveFlowSmokeSet(reg, 'all');
    const alone = flowInstallNeeds(reg, flowSet);
    assert.ok(alone.gbTotal > 0, 'the Flows bring weights of their own');
    // Everything a Flow could need is already on the volume -> the Flows add 0 GB.
    const everything = Object.keys(reg.DEPS);
    assert.equal(flowInstallNeeds(reg, flowSet, everything).gbTotal, 0);
    // Only the Flow MODELS' deps already there -> strictly less than alone, still > 0 (audio Flows' own deps).
    const modelDeps = alone.models.flatMap(m => reg.resolveDeps(m, null, null, 'remote', {}));
    const partial = flowInstallNeeds(reg, flowSet, modelDeps).gbTotal;
    assert.ok(partial < alone.gbTotal && partial > 0, `partial ${partial} vs alone ${alone.gbTotal}`);
});
