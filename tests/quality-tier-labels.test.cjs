'use strict';

/**
 * quality-tier-labels.test.cjs — MPI-883.
 *
 * The QUALITY radio printed the literal word `undefined`, three times over, on every
 * DeepInfra video model. `qualityTiersFor()` resolves a model's tiers generically —
 * a new ModelDef's `qualityTiers` reaches the radio with no code change — but the
 * id→label map in MpiOptionSelector.js is hardcoded, so every id it has not seen
 * renders as `undefined`. It had already happened once, for Krea2's `1k` (MPI-242),
 * and the comment left behind at the time is the whole warning this test replaces.
 *
 * Two claims, and the second is the one that stops it recurring:
 *   1. Every tier id any shipped model declares resolves to a real label.
 *   2. The label goes through the resolver, which falls back to the raw id, so a
 *      tier added tomorrow is at worst plain and never `undefined`.
 *
 * The component cannot be imported from Node — it pulls MpiButton → icons.js on a
 * browser-absolute path — so the map and the resolver are lifted out of the source
 * and run for real. Nothing here re-implements them.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const SRC_REL = 'js/components/Compounds/MpiOptionSelector/MpiOptionSelector.js';
const SRC = fs.readFileSync(path.join(__dirname, '..', SRC_REL), 'utf8');

const RATIOS = () => import('../js/utils/ratios.js');
const MODELS = () => import('../js/data/modelConstants/models.js').then(m => m.MODELS);

/** The component's own map and resolver, lifted and run — not a copy of them. */
function qualityLabel() {
    const map = /const QUALITY_LABELS = (\{[\s\S]*?\n\});/.exec(SRC);
    const fn = /const _qualityLabel = ([^;]+);/.exec(SRC);
    assert.ok(map, `${SRC_REL} no longer declares QUALITY_LABELS as an object literal`);
    assert.ok(fn, `${SRC_REL} no longer declares a _qualityLabel resolver`);
    return new Function(`const QUALITY_LABELS = ${map[1]}; return ${fn[1]};`)();
}

/** Every model type that ships, so a new ModelDef is covered without touching this file. */
async function shippedTypes() {
    const types = new Set();
    for (const m of await MODELS()) {
        if (m.type) types.add(String(m.type).toLowerCase());
    }
    return [...types];
}

test('every tier id a shipped model declares resolves to a real label', async () => {
    const { qualityTiersFor } = await RATIOS();
    const label = qualityLabel();
    const broken = [];

    for (const type of await shippedTypes()) {
        for (const tier of qualityTiersFor(type)) {
            const text = label(tier);
            if (typeof text !== 'string' || text === '' || text.includes('undefined')) {
                broken.push(`${type} → ${tier} → ${String(text)}`);
            }
        }
    }

    assert.deepEqual(broken, [], `these tiers render a broken label:\n  ${broken.join('\n  ')}`);
});

test('an unknown tier id falls back to itself, never to undefined', () => {
    const label = qualityLabel();
    // The next provider vocabulary nobody has thought of yet.
    assert.equal(label('1440p'), '1440p');
    assert.equal(label('8k'), '8k');
});

test('the radio builds its labels through the resolver, not the raw map', () => {
    // A direct `QUALITY_LABELS[t]` is the bug. The resolver's own declaration is the
    // one legitimate read of the map.
    const offenders = SRC.split('\n')
        .map((line, i) => [i + 1, line])
        .filter(([, line]) => /QUALITY_LABELS\[/.test(line))
        .filter(([, line]) => !/const _qualityLabel/.test(line))
        .map(([n, line]) => `${SRC_REL}:${n}  ${line.trim()}`);

    assert.deepEqual(offenders, [], `read the map through _qualityLabel:\n  ${offenders.join('\n  ')}`);
});
