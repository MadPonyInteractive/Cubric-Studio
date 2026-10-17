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

// MPI-1172: Scribble and Draw It In open their card on the user's drawing, then the result.
test('Scribble and Draw It In land the drawing as version 1 and the result as version 2', async () => {
    const { COMMANDS } = await esm('js/data/commandRegistry.js');
    const { orderVersions, shownVersion } = await esm('js/utils/outputVersions.js');
    const fs = require('node:fs');
    // graph -> the node whose picture is "my drawing"
    for (const [op, file, drawing] of [['flowScribble', 'flow_scribble.json', '1'], ['flowScribObj', 'flow_draw_it_in.json', '6']]) {
        const map = COMMANDS[op].outputVersions;
        assert.deepStrictEqual(map, { Output_Image_0: op }, op);
        for (const dir of ['', 'raw/']) {
            const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'comfy_workflows', dir + file), 'utf8'));
            if (dir) {
                const node = g.nodes.find(n => n.title === 'Output_Image_0');
                const link = g.links.find(l => l[0] === node?.inputs[0].link);
                assert.strictEqual(String(link?.[1]), drawing, `raw ${file}`);
            } else {
                const save = Object.values(g).find(n => n._meta?.title === 'Output_Image_0');
                assert.deepStrictEqual(save?.inputs.images, [drawing, 0], file);
            }
        }
        // The drawing saves first in run order or last, it is version 1 and the card shows the result.
        const v = orderVersions(['result', 'drawing'], ['Output_Image', 'Output_Image_0'], map, op);
        assert.deepStrictEqual(v.map(x => x.url), ['drawing', 'result'], op);
        assert.strictEqual(shownVersion(v), 1, op);
    }
});
