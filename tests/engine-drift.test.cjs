/**
 * The narrowed smoke-evidence staleness rule (MPI-709).
 *
 * The attestation cases are the ones that matter: it is the only thing that can talk the
 * release gate out of demanding a re-smoke, so it must apply to exactly one reviewed pin
 * hop and nothing else. A bug that let it match loosely would be a permanent, silent
 * `--allow-unproven-engine`.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const load = () => import(require('node:url').pathToFileURL(path.join(REPO, 'scripts/engine-drift.mjs')).href);

const FROM = '85057698ccb8cd62f53f484c3fae42326b0e8a06';
const TO = '287edb83f0de589984f59aa8fd4e92726087d7fb';

function tmpJson(name, body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-'));
    const p = path.join(dir, name);
    fs.writeFileSync(p, JSON.stringify(body));
    return p;
}

test('attestation applies only to the exact pin hop it names', async () => {
    const { attestedClasses } = await load();
    const doc = {
        pack: 'ComfyUI-MpiNodes',
        from: FROM,
        to: TO,
        classes: { MpiClearVram: { reason: 'pure refactor' } },
    };

    assert.deepStrictEqual([...attestedClasses(tmpJson('a.json', doc), FROM, TO)], ['MpiClearVram'],
        'the hop it was written for must be honoured');

    assert.strictEqual(attestedClasses(tmpJson('b.json', doc), FROM, 'deadbeefdeadbeef').size, 0,
        'the pin moved on again — the attestation must expire, not carry forward');
    assert.strictEqual(attestedClasses(tmpJson('c.json', doc), 'cafebabecafebabe', TO).size, 0,
        'a different starting pin is a different question');
    assert.strictEqual(attestedClasses(tmpJson('d.json', { ...doc, pack: 'SomeOtherPack' }), FROM, TO).size, 0,
        'an attestation for another pack must not apply');
    assert.strictEqual(attestedClasses(tmpJson('e.json', { ...doc, classes: { MpiClearVram: { reason: '  ' } } }), FROM, TO).size, 0,
        'a blank reason is a rubber stamp, not an attestation');
    assert.strictEqual(attestedClasses(path.join(os.tmpdir(), 'does-not-exist.json'), FROM, TO).size, 0,
        'a missing file attests nothing');
});

test('a third-party pack attestation applies only to the exact hop it names', async () => {
    const { attestedPacks } = await load();
    const A = '9ebb44be49f7848d31a6cc168732e003ec14b097';
    const B = '529c4be4c5406d375f2b962e31c05efd762cf260';
    const then = { Pack: { commit: A } };
    const now = { Pack: { commit: B } };
    const doc = (a) => ({ packs: { Pack: { from: A, to: B, reason: 'no graph loads it', ...a } } });

    assert.deepStrictEqual([...attestedPacks(tmpJson('p1.json', doc()), then, now)], ['Pack']);
    assert.strictEqual(attestedPacks(tmpJson('p2.json', doc()), then, { Pack: { commit: 'deadbeefdeadbeef' } }).size, 0,
        'the pin moved on again — the attestation must expire');
    assert.strictEqual(attestedPacks(tmpJson('p3.json', doc({ reason: ' ' })), then, now).size, 0,
        'a blank reason is a rubber stamp');
    assert.strictEqual(attestedPacks(tmpJson('p4.json', doc()), {}, now).size, 0,
        'a pack ADDED since the evidence has no from-commit and never matches');
    assert.strictEqual(attestedPacks(tmpJson('p5.json', doc()), { Other: { commit: A } }, { Other: { commit: B } }).size, 0,
        'an attestation names one pack, not any pack on the same commits');

    // A REMOVAL (MPI-595 drops Mickmumpitz): `to: null` signs off "the pack left the lock".
    const gone = (a) => ({ packs: { Pack: { from: A, to: null, reason: 'no graph loads it', ...a } } });
    assert.deepStrictEqual([...attestedPacks(tmpJson('r1.json', gone()), then, {})], ['Pack'],
        'a removal signed off from the exact pin it left at must be honoured');
    assert.strictEqual(attestedPacks(tmpJson('r2.json', gone()), then, now).size, 0,
        'a removal sign-off must not cover the pack still being in the lock at another commit');
    assert.strictEqual(attestedPacks(tmpJson('r3.json', gone()), { Pack: { commit: 'deadbeefdeadbeef' } }, {}).size, 0,
        'a removal from a different pin is a different question');
    assert.strictEqual(attestedPacks(tmpJson('r4.json', gone({ reason: '' })), then, {}).size, 0,
        'a blank reason is a rubber stamp, removal or not');
    assert.strictEqual(attestedPacks(tmpJson('r5.json', doc()), then, {}).size, 0,
        'a hop sign-off (to: <commit>) never covers the pack being removed');
});

// End to end through a throwaway git repo: node_lock.json at the evidence vs now, with
// MpiNodes unmoved so only the third-party rule decides.
test('assessPinMove: a third-party pin move is stale unless that exact hop is attested', async () => {
    const { assessPinMove } = await load();
    const { execFileSync } = require('node:child_process');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-repo-'));
    const wfDir = path.join(repo, 'comfy_workflows');
    fs.mkdirSync(path.join(repo, 'dev_configs'));
    fs.mkdirSync(wfDir);
    fs.writeFileSync(path.join(wfDir, 'g.json'), JSON.stringify({ 1: { class_type: 'KSampler' } }));
    const lock = (drama, other) => JSON.stringify({
        comfyui: { core: { tag: 'v0.34.0' } },
        nodes: { 'ComfyUI-MpiNodes': { commit: TO }, 'ComfyUI-MelodramaBox': { commit: drama }, Other: { commit: other } },
    });
    const commit = (body, date) => {
        fs.writeFileSync(path.join(repo, 'dev_configs/node_lock.json'), body);
        const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
        const g = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { env, stdio: 'ignore' });
        g('add', '-A');
        g('commit', '-q', '-m', date);
    };
    execFileSync('git', ['init', '-q', repo]);
    commit(lock('aaaaaaaaaaaa1', 'ccccccccccccc'), '2026-09-01T00:00:00Z');
    commit(lock('bbbbbbbbbbbb2', 'ccccccccccccc'), '2026-10-01T00:00:00Z');
    const base = { repo, wfDir, evidenceAt: '2026-09-15T00:00:00Z', pinMovedAt: '2026-10-01T00:00:00Z' };
    const att = (packs) => tmpJson('att.json', { pack: 'ComfyUI-MpiNodes', packs });
    const drama = { from: 'aaaaaaaaaaaa1', to: 'bbbbbbbbbbbb2', reason: 'no shipped graph loads DramaBox' };

    const none = assessPinMove({ ...base, attestationFile: att({}) });
    assert.strictEqual(none.stale, true, 'an unattested third-party move is still the blunt refusal');
    assert.match(none.reason, /ComfyUI-MelodramaBox/);

    const ok = assessPinMove({ ...base, attestationFile: att({ 'ComfyUI-MelodramaBox': drama }) });
    assert.strictEqual(ok.stale, false, 'the attested hop lets the evidence stand');
    assert.deepStrictEqual(ok.attestedPacks, ['ComfyUI-MelodramaBox']);

    commit(lock('bbbbbbbbbbbb2', 'ddddddddddddd'), '2026-10-02T00:00:00Z');
    const two = assessPinMove({ ...base, pinMovedAt: '2026-10-02T00:00:00Z', attestationFile: att({ 'ComfyUI-MelodramaBox': drama }) });
    assert.strictEqual(two.stale, true, 'a second, unattested pack moving is not covered by the first one\'s sign-off');
    assert.match(two.reason, /: Other \(/, 'only the unattested pack is named');
});

test('graphsLoading finds only graphs that name a changed class', async () => {
    const { graphsLoading } = await load();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-'));
    fs.writeFileSync(path.join(dir, 'video.json'), JSON.stringify({
        1: { class_type: 'MpiSaveVideo' }, 2: { class_type: 'KSampler' },
    }));
    fs.writeFileSync(path.join(dir, 'image.json'), JSON.stringify({
        1: { class_type: 'MpiInt' }, 2: { class_type: 'KSampler' },
    }));

    const hits = graphsLoading(new Set(['MpiSaveVideo', 'MpiWindowedSampler']), dir);
    assert.deepStrictEqual([...hits.keys()], ['video.json']);
    assert.deepStrictEqual(hits.get('video.json'), ['MpiSaveVideo']);
    assert.strictEqual(graphsLoading(new Set(), dir).size, 0, 'nothing changed reaches nothing');
});

test('an unanswerable question is stale, never clean', async () => {
    const { changedClasses } = await load();
    assert.strictEqual(changedClasses(FROM, TO, path.join(os.tmpdir(), 'no-such-repo')), null,
        'a missing checkout must return null so callers fall back to the blunt refusal');
    assert.strictEqual(changedClasses(null, TO), null, 'an unresolvable pin is unanswerable');
    assert.deepStrictEqual(changedClasses(TO, TO), new Set(), 'an unmoved pin changed nothing');
});

// Integration: the real v1.2.11 hop this rule was built for. Skipped where the sibling
// checkout is absent (CI), because its absence is correctly reported as "unanswerable".
test('the real MpiNodes v1.2.11 hop resolves to exactly its four classes', async (t) => {
    const { changedClasses, MPINODES_REPO } = await load();
    if (!fs.existsSync(MPINODES_REPO)) return t.skip(`no MpiNodes checkout at ${MPINODES_REPO}`);
    const changed = changedClasses(FROM, TO);
    if (changed === null) return t.skip('checkout present but does not carry both commits');
    assert.deepStrictEqual([...changed].sort(),
        ['MpiClearVram', 'MpiClearVramEnd', 'MpiSaveVideo', 'MpiWindowedSampler'],
        'MpiClearVram is in because vram.py gained a module-level helper; ~120 other classes stay out');
});
