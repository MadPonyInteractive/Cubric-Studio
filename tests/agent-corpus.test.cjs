'use strict';

// MPI-677 step 4 — the retrieval path (`docs/agent-corpus.md`, decision 4).
// Run: node tests/agent-corpus.test.cjs
// No framework — matches the other tests/*.test.cjs in this repo.
//
// Four things are worth asserting and nothing else is:
//
//  1. **Every declared mode is reachable.** The corpus is generated from
//     RECIPE_REGISTRY, so a recipe that gains a mode gains an entry with nobody
//     editing this file. A mode that silently stops appearing is invisible — the
//     agent just never cites that model and no error is raised.
//  2. **`text()` is not called during listing.** The laziness is the whole design:
//     listing must stay a readdir. Asserted by COUNTING reads, not by reading the
//     source — `fs.readFileSync` is patched on the core module object, which the
//     ESM module resolves at call time, so a regression to eager reads fails here.
//  3. **An `app` entry resolves to real file content**, which is the half that can
//     break from outside the code (a moved directory, an excluded build path).
//  4. **`app:operations` covers every op the Prompt Box can offer.** It is rendered
//     from commandRegistry.js, so an op added there must show up with no doc edit.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { RECIPE_REGISTRY } = require('../js/data/recipes/registry.js');
const { COMMANDS } = require('../js/data/commandRegistry.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

// Patch BEFORE the corpus module is loaded so nothing eager escapes the count.
let reads = 0;
const realReadFileSync = fs.readFileSync;
fs.readFileSync = function (...args) { reads++; return realReadFileSync.apply(this, args); };

const { listCorpus, AGENT_DOCS_DIR } = require('../services/agentCorpus.mjs');

function testEveryDeclaredModeIsInTheCorpus() {
    const entries = listCorpus();
    const ids = new Set(entries.filter((e) => e.kind === 'model').map((e) => e.id));

    let modeCount = 0;
    for (const recipe of RECIPE_REGISTRY) {
        for (const mode of Object.keys(recipe.modes ?? {})) {
            modeCount++;
            assert.ok(ids.has(`${recipe.modelId}:${mode}`),
                `${recipe.modelId}:${mode} is declared but missing from the corpus`);
        }
    }
    assert.strictEqual(ids.size, modeCount, 'one entry per declared mode, no duplicates');
    assert.ok(RECIPE_REGISTRY.length >= 12, `expected the full v1 set, found ${RECIPE_REGISTRY.length}`);
}

function testAModelEntryRendersItsBrief() {
    const entry = listCorpus().find((e) => e.id === 'minimax-h3:r2v');
    assert.ok(entry, 'minimax-h3:r2v must be in the corpus');
    assert.strictEqual(typeof entry.text, 'function', 'text is called, never read');
    const text = entry.text();
    assert.ok(text.startsWith('# MiniMax H3 — r2v'), 'the brief must be the rendered recipe, not a restatement');
    assert.ok(entry.tags.includes('minimax-h3') && entry.tags.includes('r2v'),
        `tags must carry the id and the mode, got ${entry.tags.join(', ')}`);
}

function testListingReadsNoFiles() {
    // The one assertion that defends the design rather than the output. Reset the
    // counter, list, and require it to stay put: every `text()` is a closure, so a
    // listing touches the disk exactly once (the readdir) and never for content.
    reads = 0;
    const entries = listCorpus();
    assert.strictEqual(reads, 0, `listCorpus() read ${reads} file(s) — text() must stay lazy`);
    assert.ok(entries.every((e) => typeof e.text === 'function'), 'every entry defers its text');

    // ...and calling one DOES read, which is what makes the count above meaningful.
    const app = entries.find((e) => e.kind === 'app');
    assert.ok(app, 'at least one docs/agent/*.md must ship');
    app.text();
    assert.strictEqual(reads, 1, 'calling text() on an app entry reads exactly its own file');
}

function testAnAppEntryResolvesToRealContent() {
    const entry = listCorpus().find((e) => e.id === 'app:prompt-enhancement');
    assert.ok(entry, 'the seed doc must be in the corpus');
    assert.strictEqual(entry.kind, 'app');
    assert.strictEqual(entry.title, 'Prompt enhancement', 'the title comes from the filename');
    assert.ok(entry.tags.includes('app'), 'an app entry is tagged as one');

    const text = entry.text();
    assert.ok(text.includes('# Prompt enhancement'), 'text() must return the file, not a summary');
    assert.strictEqual(text, realReadFileSync(path.join(AGENT_DOCS_DIR, 'prompt-enhancement.md'), 'utf8'));
}

function testTheFirstPlaybooksShip() {
    const entries = listCorpus();
    for (const id of ['app:runpod-setup', 'app:gallery', 'app:operations']) {
        const entry = entries.find((e) => e.id === id);
        assert.ok(entry, `${id} must be in the corpus`);
        assert.strictEqual(entry.kind, 'app');
        const text = entry.text();
        assert.ok(text.startsWith('# ') && text.trim().split('\n').length > 5, `${id} must be a real document, got ${text.length} chars`);
    }
}

function testOperationsIsRenderedFromTheRegistries() {
    const text = listCorpus().find((e) => e.id === 'app:operations').text();
    const runs = (key) => MODELS.some((m) => m.supportedOps.includes(key));
    const modelOps = Object.entries(COMMANDS).filter(([, c]) => !c.stub && !c.universal);
    const offered = modelOps.filter(([key]) => runs(key));
    assert.ok(offered.length >= 16, `expected every model op, found ${offered.length}`);
    for (const [key] of modelOps.filter(([k]) => !runs(k))) {
        assert.ok(!text.includes(`(\`${key}\`)`), `op ${key} has no model to run it, so it must not be listed`);
    }
    for (const line of text.split('\n').filter((l) => l.startsWith('Models: '))) {
        const names = line.slice('Models: '.length).split(', ');
        assert.strictEqual(new Set(names).size, names.length, `duplicate model in "${line}"`);
    }
    for (const [key, cmd] of offered) {
        assert.ok(text.includes(`## ${cmd.label} (\`${key}\`)`), `op ${key} is offered but missing from app:operations`);
        assert.ok(text.includes(cmd.info), `op ${key} must carry its registry info, not a rewrite`);
    }
    const t2i = text.split('\n## ').find((s) => s.includes('(`t2i`)'));
    for (const m of MODELS.filter((x) => x.supportedOps.includes('t2i'))) {
        assert.ok(t2i.includes(m.name), `${m.name} runs t2i but is not listed under it`);
    }
    assert.ok(!/\(`flow[A-Z]/.test(text), 'Flows are their own surface, not operations');
}

// ── MPI-774 Phase 3b: model guides and the Vision skills ──────────────────────

const { resolveRecipe } = require('../js/data/recipes/registry.js');
const { guideIdsByModel, guideEntries, GUIDES_DIR, SKILL_DIRS, isVisionSkill } = require('../services/agentCorpus.mjs');

function testEveryShippedModelHasAGuide() {
    // The loop will not send a model's first prompt before its guide is read, so a model
    // with no guide is a model the agent writes for blind. One guide per recipe in use.
    const byModel = guideIdsByModel();
    for (const m of MODELS) {
        const recipe = resolveRecipe(m.enhanceRecipe ?? m.type);
        assert.ok(recipe, `${m.id} resolves to no recipe`);
        assert.strictEqual(byModel[m.id][0], `guide:${recipe.modelId}`,
            `${m.id} (recipe ${recipe.modelId}) needs docs/agent/models/${recipe.modelId}.md`);
    }
}

function testEveryGuideIsARealGuide() {
    const recipeIds = new Set(RECIPE_REGISTRY.map((r) => r.modelId));
    const guides = listCorpus().filter((e) => e.kind === 'guide');
    assert.ok(guides.length > 0, 'no guide in the corpus');
    for (const g of guides) {
        const rel = g.id.slice('guide:'.length);
        const id = rel.split('/')[0];
        assert.ok(recipeIds.has(id), `${g.id} names no recipe: a guide file is named after its recipe id`);
        const text = g.text();
        assert.ok(text.startsWith('# '), `${g.id} must open with a heading`);
        const lines = text.trim().split('\n').length;
        assert.ok(lines >= 30 && lines <= 200, `${g.id} is ${lines} lines, want 30-200`);
        assert.ok(!/TODO|TBD|\[INSERT/i.test(text), `${g.id} carries a placeholder`);
        assert.ok(!/—/.test(realReadFileSync(path.join(GUIDES_DIR, `${rel}.md`), 'utf8')),
            `${g.id} uses an em dash (Fabio's copy rule)`);
        // MPI-903: the guide is the one home for how to prompt a model; a price lives in the
        // estimate, never in a doc that goes stale the day a provider changes it.
        assert.ok(!/\$\d/.test(text), `${g.id} quotes a price`);
    }
}

/** MPI-903: a model over 200 lines becomes a folder of sub-skills behind its router guide. */
function testAModelFolderListsItsSubSkillsAfterTheRouter() {
    const os = require('node:os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guides-'));
    try {
        const id = RECIPE_REGISTRY[0].modelId;
        fs.writeFileSync(path.join(dir, `${id}.md`), '# Router\n');
        fs.mkdirSync(path.join(dir, id));
        fs.writeFileSync(path.join(dir, id, 'lenses.md'), '# Lenses\n');
        fs.writeFileSync(path.join(dir, id, 'acting.md'), '# Acting\n');
        const ids = guideEntries(dir).map((e) => e.id);
        assert.deepEqual(ids, [`guide:${id}`, `guide:${id}/acting`, `guide:${id}/lenses`]);
        assert.equal(guideEntries(dir)[2].text(), '# Lenses\n');
        const byModel = Object.values(guideIdsByModel(dir)).find((g) => g.length);
        assert.deepEqual(byModel, [`guide:${id}`, `guide:${id}/acting`, `guide:${id}/lenses`], 'the router comes first: the gate reads guides[0]');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function testEveryVisionSkillIsInTheCorpus() {
    const root = SKILL_DIRS[0];
    const skills = listCorpus().filter((e) => e.kind === 'skill');
    const dirs = fs.readdirSync(root).filter(isVisionSkill);
    assert.ok(dirs.length >= 5, `expected the cubric-vision skill family, found ${dirs.join(', ')}`);
    for (const dir of dirs) {
        for (const file of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.md'))) {
            const base = file.slice(0, -3);
            const id = base === 'SKILL' ? `skill:${dir}` : `skill:${dir}/${base}`;
            const entry = skills.find((e) => e.id === id);
            assert.ok(entry, `${id} is missing`);
            const text = entry.text();
            assert.ok(text.endsWith(realReadFileSync(path.join(root, dir, file), 'utf8')), `${id} must carry the whole skill file`);
            assert.match(text, /^> You are the in-app agent\./, `${id} must open with the in-app preamble`);
            assert.match(text, /you never delete/, `${id}'s preamble must carry the deletion rule`);
        }
    }
}

async function testTheBuildStagesTheSkillsWhereTheCorpusLooks() {
    const os = require('os');
    const { copyAgentSkills } = await import('../scripts/build-portable.mjs');
    const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-stage-'));
    try {
        const names = await copyAgentSkills(path.join(__dirname, '..'), appRoot);
        assert.deepStrictEqual(names.sort(), fs.readdirSync(SKILL_DIRS[0]).filter(isVisionSkill).sort(),
            'the build and the corpus must agree on which skills are the Vision family');
        const staged = path.join(appRoot, path.relative(path.join(__dirname, '..'), SKILL_DIRS[1]));
        for (const name of names) {
            assert.ok(fs.existsSync(path.join(staged, name, 'SKILL.md')), `${name} was not staged where the corpus looks`);
        }
    } finally {
        fs.rmSync(appRoot, { recursive: true, force: true });
    }
}

const tests = [
    testEveryDeclaredModeIsInTheCorpus,
    testAModelEntryRendersItsBrief,
    testListingReadsNoFiles,
    testAnAppEntryResolvesToRealContent,
    testTheFirstPlaybooksShip,
    testOperationsIsRenderedFromTheRegistries,
    testEveryShippedModelHasAGuide,
    testEveryGuideIsARealGuide,
    testAModelFolderListsItsSubSkillsAfterTheRouter,
    testEveryVisionSkillIsInTheCorpus,
    testTheBuildStagesTheSkillsWhereTheCorpusLooks,
];

(async () => {
    let failed = 0;
    for (const t of tests) {
        try {
            await t();
            console.log(`  ok  ${t.name}`);
        } catch (err) {
            failed++;
            console.error(`  FAIL ${t.name}\n    ${err.message}`);
        }
    }
    fs.readFileSync = realReadFileSync;
    console.log(failed ? `\n${failed} of ${tests.length} agent corpus tests FAILED.` : `\nAll ${tests.length} agent corpus tests passed.`);
    if (failed) process.exitCode = 1;
})();
