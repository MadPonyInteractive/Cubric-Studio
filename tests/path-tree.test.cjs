/**
 * path-tree.test.cjs — MPI-1057.
 *
 * `js/utils/pathTree.js` builds the folder tree behind MpiTreePicker (pick one LoRA) and
 * MpiFileTree (the Upload models overlay). Both separators nest, root files stay at the
 * top, and an item's own fields (a size note, disabled) ride along to its file row.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

test('buildTree nests both separators and keeps item fields', async () => {
    const { buildTree, sortedFolderNames, sortedFiles } = await import('../js/utils/pathTree.js');
    const tree = buildTree([
        'b.safetensors',
        { value: 'CHROMA\\x.safetensors', note: '1.2GB', disabled: true },
        'CHROMA/sub/y.safetensors',
        'a.safetensors',
    ]);
    assert.deepStrictEqual(sortedFiles(tree).map(f => f.label), ['a.safetensors', 'b.safetensors']);
    assert.deepStrictEqual(sortedFolderNames(tree), ['CHROMA']);
    const chroma = tree.folders.get('CHROMA');
    assert.deepStrictEqual(chroma.files, [{ value: 'CHROMA\\x.safetensors', note: '1.2GB', disabled: true, label: 'x.safetensors' }]);
    assert.deepStrictEqual(chroma.folders.get('sub').files, [{ label: 'y.safetensors', value: 'CHROMA/sub/y.safetensors' }]);
});
