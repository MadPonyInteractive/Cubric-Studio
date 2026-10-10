'use strict';
/**
 * MPI-1068 — a model whose every op was SKIP during the run must land in `unproven`,
 * not `modelsRun`. Its covered siblings must follow unless another executed model
 * proves them.
 *
 * Root cause: set.scope was written at PLAN time (resolveSmokeSet) and never updated
 * to reflect which ops actually executed. A model with a missing workflow file would
 * SKIP every op but remain in modelsRun, so release:check would print "covers all N
 * models" while the model never ran.
 *
 * postRunScope(set, results) is the pure function that recomputes scope after
 * execution. PASS or FAIL = executed; SKIP = not executed.
 */

const path = require('node:path');
const assert = require('node:assert/strict');
const { test, before } = require('node:test');

const REPO = path.resolve(__dirname, '..');
let postRunScope;

before(async () => {
    const url = `file:///${path.join(REPO, 'scripts', 'smoke-workflows.mjs').replace(/\\/g, '/')}`;
    ({ postRunScope } = await import(url));
});

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal set-entry. `covers` is the list of sibling model ids. */
function entry(id, covers = [], ops = ['t2i']) {
    return { model: { id }, ops, covers };
}

/** Build a results array from a map of op-name -> status for a model. */
function opResults(modelId, opStatuses) {
    return Object.entries(opStatuses).map(([op, status]) => ({ model: modelId, op, status }));
}

/**
 * Attach a plan-time scope to a set array, as resolveSmokeSet does.
 * modelsInRegistry = total of run + covers + unproven.
 */
function attachScope(set, unproven = []) {
    const modelsRun = set.map(e => e.model.id);
    const covers = [...new Set(set.flatMap(e => e.covers))];
    const modelsInRegistry = new Set([...modelsRun, ...covers, ...unproven]).size;
    set.scope = { requested: 'all', modelsRun, covers, unproven, modelsInRegistry };
    return set;
}

// ── tests ─────────────────────────────────────────────────────────────────────

test('a model with every op SKIP moves to unproven', () => {
    const set = attachScope([
        entry('qwen-image-2-1', [], ['t2i', 'edit']),  // all ops will SKIP
        entry('sdxl-nsfw', ['sdxl-lustify']),
    ]);
    const results = [
        ...opResults('qwen-image-2-1', { t2i: 'SKIP', edit: 'SKIP' }),
        ...opResults('sdxl-nsfw', { t2i: 'PASS' }),
    ];

    const scope = postRunScope(set, results);

    assert.deepStrictEqual(scope.modelsRun, ['sdxl-nsfw'],
        'qwen-image-2-1 had zero executed ops so must not be in modelsRun');
    assert.ok(scope.unproven.includes('qwen-image-2-1'),
        'a fully-skipped model must land in unproven');
});

test('covered siblings of a fully-skipped model also move to unproven', () => {
    // qwen-image-2-1 covers qwen-image-2-0 (same class_type set). If qwen-2-1 skips,
    // qwen-2-0 is no longer proven either.
    const set = attachScope([
        entry('qwen-image-2-1', ['qwen-image-2-0']),  // covers a sibling
        entry('sdxl-nsfw', ['sdxl-lustify']),
    ]);
    const results = [
        ...opResults('qwen-image-2-1', { t2i: 'SKIP' }),
        ...opResults('sdxl-nsfw', { t2i: 'PASS' }),
    ];

    const scope = postRunScope(set, results);

    assert.ok(scope.unproven.includes('qwen-image-2-1'), 'skipped model is unproven');
    assert.ok(scope.unproven.includes('qwen-image-2-0'),
        'the covered sibling of a fully-skipped model must also be unproven');
    assert.ok(!scope.covers.includes('qwen-image-2-0'),
        'an unexecuted cover must not remain in covers');
});

test('a model with at least one PASS stays in modelsRun', () => {
    const set = attachScope([
        entry('klein-4b', [], ['t2i', 'inpaint']),
    ]);
    const results = opResults('klein-4b', { t2i: 'PASS', inpaint: 'SKIP' });

    const scope = postRunScope(set, results);

    assert.ok(scope.modelsRun.includes('klein-4b'),
        'one executed op is enough to keep the model in modelsRun');
    assert.deepStrictEqual(scope.unproven, [],
        'no unproven models when all entries executed');
});

test('a model with at least one FAIL stays in modelsRun', () => {
    const set = attachScope([
        entry('minimax-h3', [], ['t2v_ms', 'i2v_ms']),
    ]);
    const results = opResults('minimax-h3', { t2v_ms: 'FAIL', i2v_ms: 'SKIP' });

    const scope = postRunScope(set, results);

    assert.ok(scope.modelsRun.includes('minimax-h3'),
        'a FAIL counts as executed — the op ran, it just failed');
});

test('a fully-executed sibling cover still proves the family even when another entry skips', () => {
    // sdxl-nsfw runs and proves sdxl-lustify. qwen-image-2-1 skips.
    const set = attachScope([
        entry('qwen-image-2-1', ['qwen-image-2-0']),
        entry('sdxl-nsfw', ['sdxl-lustify']),
    ]);
    const results = [
        ...opResults('qwen-image-2-1', { t2i: 'SKIP' }),
        ...opResults('sdxl-nsfw', { t2i: 'PASS' }),
    ];

    const scope = postRunScope(set, results);

    assert.ok(scope.covers.includes('sdxl-lustify'),
        'sdxl-lustify is proved by sdxl-nsfw which executed');
    assert.ok(!scope.covers.includes('qwen-image-2-0'),
        'qwen-image-2-0 is not proved since its prover skipped');
    assert.deepStrictEqual(scope.unproven.sort(), ['qwen-image-2-0', 'qwen-image-2-1'].sort());
});

test('plan-time unproven models stay unproven after execution', () => {
    // krea2 was never in the run set at all (not in any family this run touches).
    const set = attachScope(
        [entry('sdxl-nsfw', ['sdxl-lustify'])],
        ['krea2'],
    );
    const results = opResults('sdxl-nsfw', { t2i: 'PASS' });

    const scope = postRunScope(set, results);

    assert.ok(scope.unproven.includes('krea2'),
        'a model never in the run set must stay unproven');
});

test('modelsInRegistry is preserved unchanged from the plan-time scope', () => {
    const set = attachScope([entry('sdxl-nsfw', [])]);
    const results = opResults('sdxl-nsfw', { t2i: 'PASS' });
    const scope = postRunScope(set, results);
    assert.strictEqual(scope.modelsInRegistry, set.scope.modelsInRegistry);
});
