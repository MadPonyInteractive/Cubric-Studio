/**
 * changedRows / rowFingerprint — the default smoke run tests only what changed (2026-10-14).
 *
 * Every session used to re-prove the whole matrix, 48 ops that were already green, because
 * nothing recorded WHAT a row had proven. Each row now carries a fingerprint of its graph and
 * weights, and a row re-runs only when that moved, when it was never green, or when a node
 * class it loads changed under it. Anything the rule cannot see still runs.
 */
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');

let changedRows, rowFingerprint;
test.before(async () => {
    // The first log() of a process truncates the transcript; never let a test touch the committed one.
    process.env.CUBRIC_SMOKE_RUN_LOG = path.join(os.tmpdir(), `smoke-changed-only-${process.pid}.txt`);
    ({ changedRows, rowFingerprint } = await import('../scripts/smoke-workflows.mjs'));
});

const WF = 'flow_make_seamless.json';
const dep = { filename: 'a.safetensors', url: 'https://x/a', size: '1 GB' };

test('fingerprint: stable, order-blind, and moves with a weight or the graph', () => {
    const fp = rowFingerprint([WF], [dep]);
    assert.equal(fp, rowFingerprint([WF], [dep]));
    assert.equal(rowFingerprint([WF, 'flow_scribble.json'], [dep]), rowFingerprint(['flow_scribble.json', WF], [dep]));
    assert.notEqual(fp, rowFingerprint([WF], [{ ...dep, url: 'https://x/b' }]), 'a swapped weight is a change');
    assert.notEqual(fp, rowFingerprint(['flow_scribble.json'], [dep]), 'another graph is a change');
    assert.notEqual(fp, rowFingerprint(['no_such_graph.json'], [dep]));
});

const prior = {
    at: '2026-10-14T00:00:00Z',
    results: [
        { model: 'klein-4b', op: 't2i', status: 'PASS', fp: 'aaa' },
        { model: 'klein-4b', op: 'i2i', status: 'PASS', fp: 'bbb' },
        { model: 'wan-22', op: 'i2v_ms', status: 'FAIL', fp: 'ccc' },
        { model: 'flow', op: 'stems', status: 'PASS' },
        { model: 'flow', op: 'outpaint', status: 'PASS', fp: 'ddd' },
    ],
};

test('only the rows that moved come back, each with its reason', () => {
    const rows = [
        { key: 'klein-4b/t2i', fp: 'aaa', files: ['klein_t2i.json'] },
        { key: 'klein-4b/i2i', fp: 'NEW', files: ['klein_t2i.json'] },
        { key: 'wan-22/i2v_ms', fp: 'ccc', files: ['wan.json'] },
        { key: 'flow/stems', fp: 'eee', files: ['flow_stems.json'] },
        { key: 'flow/outpaint', fp: 'ddd', files: ['flow_outpaint.json'] },
        { key: 'flow/make-seamless', fp: 'fff', files: [WF] },
    ];
    assert.deepEqual(changedRows(prior, rows), [
        { key: 'klein-4b/i2i', why: 'graph or weights changed' },
        { key: 'wan-22/i2v_ms', why: 'last run FAIL' },
        { key: 'flow/stems', why: 'recorded before fingerprints' },
        { key: 'flow/make-seamless', why: 'new' },
    ]);
});

test('a node change re-runs exactly the graphs that load it', () => {
    const rows = [
        { key: 'klein-4b/t2i', fp: 'aaa', files: ['klein_t2i.json'] },
        { key: 'flow/outpaint', fp: 'ddd', files: ['flow_outpaint.json'] },
    ];
    const stale = new Map([['flow_outpaint.json', ['MpiStitch']]]);
    assert.deepEqual(changedRows(prior, rows, stale), [{ key: 'flow/outpaint', why: 'node change: MpiStitch' }]);
});

test('nothing changed = nothing to rent; no evidence = everything runs', () => {
    assert.deepEqual(changedRows(prior, [{ key: 'klein-4b/t2i', fp: 'aaa', files: ['klein_t2i.json'] }]), []);
    assert.equal(changedRows(null, [{ key: 'klein-4b/t2i', fp: 'aaa', files: [] }])[0].why, 'no usable evidence');
});
