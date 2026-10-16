/**
 * page-wide-restyle.test.cjs — MPI-1142.
 *
 * Two CSS shapes made the whole page restyle, and both are invisible until a project
 * holds a few hundred cards (Fabio: 50-100 ms long tasks, dragging and panels lagging):
 *
 *   1. A `:has()` keyed on a bare tag (`:has(audio)`). Chromium cannot rule an inserted
 *      element out of it, so EVERY element added anywhere under it restyled all ~9,000
 *      elements of the page. Measured: 1 full restyle per gallery render, 0 with a class.
 *   2. An infinite animation on an element that is only hidden by a parent's opacity.
 *      The card spinner sat under every idle card's opacity-0 preview layer and restyled
 *      every card on every frame.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const cssFiles = (dir) => fs.readdirSync(path.join(root, dir), { recursive: true })
    .filter((f) => f.endsWith('.css')).map((f) => path.join(dir, f));

test('no :has() keyed on a bare tag name', () => {
    const bad = [];
    for (const f of [...cssFiles('js'), ...cssFiles('styles')]) {
        const src = fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const m of src.matchAll(/:has\(\s*>?\s*[a-z][a-z0-9-]*\s*\)/g)) bad.push(`${f}: ${m[0]}`);
    }
    assert.deepStrictEqual(bad, [], 'use a BEM modifier set by JS instead (see MpiFlowResultDock setContent)');
});

test('the gallery card spinner spins only while its preview layer is visible', () => {
    const src = fs.readFileSync(path.join(root, 'js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.css'), 'utf8');
    const base = src.match(/\n\.mpi-group-card__spinner\s*\{[^}]*\}/);
    assert.ok(base, 'base .mpi-group-card__spinner rule not found');
    assert.doesNotMatch(base[0], /animation/, 'the base spinner rule must not animate');
    assert.match(src, /\.mpi-group-card__preview--visible \.mpi-group-card__spinner\s*\{[^}]*animation:/);
});
