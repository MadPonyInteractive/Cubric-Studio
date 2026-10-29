/**
 * MPI-1335 — Reuse with the dialog turned off (Settings, "ask" off) must still reopen a Flow card's Flow.
 *
 * The dialog's "Apply to App" was renamed from dest 'app' to 'flow' (the dialog and the
 * `dest === 'flow'` check), but both blocks' no-dialog fast paths still passed 'app'. So with the
 * dialog off, Reuse on a Flow card never reached `openFlowFromReuse` and fell into the prompt box.
 * A non-Flow card is unaffected by 'flow': `openFlowFromReuse` returns false and the inject runs.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BLOCKS = [
    'js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js',
    'js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js',
];

/** The literal dest of every one-line `_applyPromptReuse(..., '<dest>')` call. */
const literalDests = src => [...src.matchAll(/_applyPromptReuse\([^\n]*,\s*'(\w+)'\);/g)].map(m => m[1]);

for (const rel of BLOCKS) {
    test(`${path.basename(rel)}: every Reuse call names a destination the Flow branch knows`, () => {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.match(src, /dest === 'flow' && openFlowFromReuse\(/, 'the Flow branch moved: update this test');
        const dests = literalDests(src);
        assert.ok(dests.length > 0, 'no literal-dest _applyPromptReuse call found: update this test');
        assert.deepStrictEqual(dests.filter(d => d !== 'flow'), [], 'a fast path passes a dest that never opens the Flow');
        assert.doesNotMatch(src, /dest = 'app'/, 'the default dest is one the Flow branch never matches');
    });
}

test('the matcher sees the call shape the bug had', () => {
    assert.deepStrictEqual(literalDests("_applyPromptReuse(payload, _reuseIncludes(options), 'app');"), ['app']);
});
