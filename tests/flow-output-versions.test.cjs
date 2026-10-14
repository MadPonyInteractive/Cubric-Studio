/**
 * flow-output-versions.test.cjs — MPI-1086. A graph that makes several pictures on the way to ONE
 * result (the Character Sheet Editor: mannequin -> edit -> head removal) lands them as versions of
 * one card, in the graph's capture order, each filed under its own op; the card shows the last one
 * the run did not ask to keep out of sight.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const esm = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));
const HEAD = 'flowCharacterSheetHeadless';

test('outputs are ordered by their capture, not by when they finished', async () => {
    const { orderVersions } = await esm('js/utils/outputVersions.js');
    const map = { Output_Image_3: HEAD };
    const got = orderVersions(['edit', 'head', 'mannequin'], ['Output_Image_2', 'Output_Image_3', 'Output_Image'], map, 'qwen');
    assert.deepStrictEqual(got, [
        { url: 'mannequin', operation: 'qwen' }, { url: 'edit', operation: 'qwen' }, { url: 'head', operation: HEAD }]);
    // A capture the run skipped (no mannequin) leaves no gap; unknown titles keep the urls' order.
    assert.deepStrictEqual(orderVersions(['h', 'e'], ['Output_Image_3', 'Output_Image'], map, 'klein').map(v => v.url), ['e', 'h']);
    assert.deepStrictEqual(orderVersions(['a', 'b'], null, map, 'klein').map(v => v.operation), ['klein', 'klein']);
});

test('the card shows the last version the run did not hide', async () => {
    const { shownVersion } = await esm('js/utils/outputVersions.js');
    const items = [{ operation: 'qwen' }, { operation: 'qwen' }, { operation: HEAD }];
    assert.strictEqual(shownVersion(items), 2, 'Headless front body on');
    assert.strictEqual(shownVersion(items, [HEAD]), 1, 'off: the edit');
    assert.strictEqual(shownVersion([{ operation: HEAD }], [HEAD]), 0, 'nothing else: the last');
});

test('the Character Sheet Editor ops land their head removal as the Headless version', async () => {
    const { COMMANDS } = await esm('js/data/commandRegistry.js');
    for (const op of ['flowCharacterSheetEdit', 'flowCharacterSheetEditQwen']) {
        assert.deepStrictEqual(COMMANDS[op].outputVersions, { Output_Image_3: HEAD }, op);
    }
});
