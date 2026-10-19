// MPI-1156 — js/services/mediaVerdicts.js: the child-safety gate's per-file answers, kept in the
// card sidecar so a picture is asked once, not on every run. Stub sidecars and a stub describer.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../js/services/mediaVerdicts.js');
const url = (name) => `/project-file?path=${encodeURIComponent(`C:\\proj\\Media\\${name}`)}`;

/** A project whose cards are `names`, and a fake server holding their sidecars. */
function setup(names, sidecars = {}) {
    const project = { id: 'p1', folderPath: 'C:\\proj', itemGroups: [{ id: 'g', history: names.map((n) => ({ id: n, filePath: url(n) })) }] };
    const writes = [];
    const http = async (route, init) => {
        const body = JSON.parse(init.body);
        if (route === '/load-meta-batch') {
            return { json: async () => ({ items: Object.fromEntries(body.ids.map((id) => [id, { meta: sidecars[id] ?? null }])) }) };
        }
        writes.push(body);
        sidecars[body.itemId] = { ...sidecars[body.itemId], ...body.updates };
        return {};
    };
    return { project, http, sidecars, writes };
}

test('asked once per file, kept, and reused', async () => {
    const { cachedVerdicts } = await load();
    const s = setup(['a.png', 'b.png'], { 'a.png': {}, 'b.png': {} });
    let asked = 0;
    const o = { key: 'ageVerdict', question: 'Q1', project: s.project, http: s.http, ask: async (u) => { asked += 1; return u.includes('a.png'); } };
    assert.deepStrictEqual(await cachedVerdicts([url('a.png'), url('b.png')], o), [true, false]);
    assert.strictEqual(asked, 2);
    assert.deepStrictEqual(s.sidecars['a.png'].ageVerdict.answer, 'YES');
    assert.deepStrictEqual(s.sidecars['b.png'].ageVerdict.answer, 'NO');
    assert.deepStrictEqual(await cachedVerdicts([url('a.png'), url('b.png')], o), [true, false]);
    assert.strictEqual(asked, 2, 'kept answers are not asked again');
});

test('a reworded question asks again; a path in another spelling is the same card', async () => {
    const { cachedVerdicts, questionHash } = await load();
    const s = setup(['a.png'], { 'a.png': { ageVerdict: { q: questionHash('Q1'), answer: 'NO' } } });
    let asked = 0;
    const ask = async () => { asked += 1; return true; };
    assert.deepStrictEqual(await cachedVerdicts(['c:/proj/media/A.PNG'], { key: 'ageVerdict', question: 'Q1', ask, project: s.project, http: s.http }), [false]);
    assert.strictEqual(asked, 0);
    assert.deepStrictEqual(await cachedVerdicts([url('a.png')], { key: 'ageVerdict', question: 'Q2', ask, project: s.project, http: s.http }), [true]);
    assert.strictEqual(asked, 1);
    assert.strictEqual(s.sidecars['a.png'].ageVerdict.q, questionHash('Q2'));
    assert.notStrictEqual(questionHash('Q1'), questionHash('Q2'));
});

// Fabio 2026-10-19: a young-looking anime character aged up by an edit is judged as the adult it
// now shows. An edit of a YES used to be YES without asking, so it could never be used.
test('an edit is judged on its own look: a YES on its source is never taken', async () => {
    const { cachedVerdicts, questionHash } = await load();
    const q = questionHash('Q1');
    const from = (...n) => ({ generationSettings: { mediaItems: n.map((x) => ({ url: url(x) })) } });
    const s = setup(['young.png', 'aged.png'], {
        'young.png': { ageVerdict: { q, answer: 'YES' } },
        'aged.png': from('young.png'),
    });
    let asked = 0;
    const o = { key: 'ageVerdict', question: 'Q1', inherit: true, project: s.project, http: s.http, ask: async () => { asked += 1; return false; } };
    assert.deepStrictEqual(await cachedVerdicts([url('aged.png')], o), [false]);
    assert.strictEqual(asked, 1, 'the edit itself is asked');
    assert.strictEqual(s.sidecars['aged.png'].ageVerdict.answer, 'NO');
});

test('no card: asked every time, nothing written; no answer: null, nothing kept', async () => {
    const { cachedVerdicts } = await load();
    const s = setup(['a.png'], { 'a.png': {} });
    let asked = 0;
    const o = { key: 'ageVerdict', question: 'Q1', project: s.project, http: s.http, ask: async () => { asked += 1; return false; } };
    await cachedVerdicts(['D:\\agent\\pic.png'], o);
    await cachedVerdicts(['D:\\agent\\pic.png'], o);
    assert.strictEqual(asked, 2);
    assert.strictEqual(s.writes.length, 0);
    for (const ask of [async () => null, async () => { throw new Error('down'); }]) {
        assert.deepStrictEqual(await cachedVerdicts([url('a.png')], { ...o, ask }), [null]);
    }
    assert.strictEqual(s.writes.length, 0, 'an unanswered look is never kept');
    assert.deepStrictEqual(await cachedVerdicts([url('a.png')], { ...o, project: null }), [false], 'no project: still asked');
});
