'use strict';

/**
 * model-picker-cloud.test.cjs — MPI-865.
 *
 * The picker is a renderer Compound behind an overlay, so how it LOOKS is Fabio's check.
 * What a test can hold are the things that go wrong silently:
 *
 *   1. The two bugs' PREMISES, asserted against the real ModelDefs rather than assumed.
 *      A cloud model has no weight tier and no LoRA/upscale, which is exactly why the
 *      tier word and the settings button were wrong on it. If a later cloud model ships
 *      WITH one of those, this fails and the hidden control gets revisited instead of
 *      quietly lying.
 *   2. The flag's icon key must exist in `icons.js`. `renderIcon` on an unknown name
 *      renders nothing, so a typo is an invisible badge, not an error.
 *   3. The family colour must actually WIN. Both rules existing proves nothing about the
 *      cascade; the override needs higher specificity than the base, or every cloud tile
 *      stays rose including the clip models.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { MODELS } = require('../js/data/modelConstants/models.js');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const PICKER = read('js', 'components', 'Compounds', 'MpiModelPicker', 'MpiModelPicker.js');
const SHEET = read('js', 'components', 'Primitives', 'MpiTileSheet', 'MpiTileSheet.js');
const SHEET_CSS = read('js', 'components', 'Primitives', 'MpiTileSheet', 'MpiTileSheet.css');
const ICONS = read('js', 'utils', 'icons.js');

const CLOUD = MODELS.filter(m => m.provider);

test('there are cloud models to reason about at all', () => {
    assert.ok(CLOUD.length > 0, 'no model carries a `provider`; every assertion below would be vacuous');
});

// ── 1. the two bugs' premises, against the real ModelDefs ────────────────────────────────

test('no cloud model has a size tier — so the `|| \'balanced\'` fallback described nothing', () => {
    const withTier = CLOUD.filter(m => m.sizeTier);
    assert.deepEqual(withTier.map(m => m.id), [],
        'a cloud model gained a sizeTier; a weight class on a model with no weights needs a decision, not a default');
});

test('no cloud model offers a LoRA rack or an upscale op — the hidden control hides nothing real', () => {
    const withLora = CLOUD.filter(m => m.loras || m.loraTypes || m.styleLoras);
    assert.deepEqual(withLora.map(m => m.id), [],
        'a cloud model declared LoRAs; the picker hides its settings button, so that would be unreachable');

    const withUpscale = CLOUD.filter(m => (m.supportedOps || []).some(op => /upscal/i.test(op)));
    assert.deepEqual(withUpscale.map(m => m.id), [],
        'a cloud model gained an upscale op; the picker hides the control that would reach it');
});

// ── 2. the picker reads `provider`, and drops what a cloud model does not have ────────────

test('the tile item derives its cloud flag from `provider`, the one discriminator', () => {
    assert.match(PICKER, /const isCloud = !!model\.provider;/,
        'the picker must key on `provider` — the same discriminator MpiModelManager uses');
    assert.match(PICKER, /cloud: isCloud,/,
        'the tile item must pass the flag through to MpiTileSheet');
});

test('a cloud tile gets no tier word and no LoRA & Upscale control', () => {
    assert.match(PICKER, /meta: isCloud\s*\n\s*\? \(model\.dropdownMeta \|\| 'CLOUD'\)/,
        'the meta must not fall back to a weight tier on a cloud model — that is the CLOUD · BALANCED bug');
    assert.match(PICKER, /state: \(isCloud \|\| model\.showSettings === false\) \? '' :/,
        'the settings control must be dropped for a cloud model');
});

// ── 3. the flag exists, its icon exists, and the colour rule wins ────────────────────────

test('MpiTileSheet declares a cloud flag whose icon is a real one', () => {
    const row = SHEET.match(/\{\s*key: 'cloud',\s*icon: '([a-zA-Z0-9_]+)',/);
    assert.ok(row, 'TILE_FLAGS has no `cloud` row — the badge cannot render');
    const icon = row[1];
    // Keys in ICONS are quoted; assert.ok rather than assert.match so a failure reports the
    // name rather than dumping the whole registry into the diff.
    const declared = new RegExp(`^\\s+'?${icon}'?:`, 'm').test(ICONS);
    assert.ok(declared,
        `TILE_FLAGS points at icon '${icon}', which icons.js does not export — renderIcon would draw nothing`);
});

test('a cloud CLIP model takes Video orange, and the rule actually outranks the base', () => {
    const base = SHEET_CSS.match(/^(\.mpi-tile__flag--cloud)\s*\{([^}]*)\}/m);
    const override = SHEET_CSS.match(/^(\.mpi-tile--video \.mpi-tile__flag--cloud)\s*\{([^}]*)\}/m);
    assert.ok(base, 'no base colour for the cloud flag');
    assert.ok(override, 'no Video-orange override for a cloud clip model');

    assert.match(base[2], /var\(--vision-accent\)/, 'the image default must be Vision rose');
    assert.match(override[2], /var\(--video-accent\)/, 'a clip model must be Video orange');

    // Resolve the cascade rather than trusting that both rules exist: more class
    // selectors is strictly higher specificity, so the override wins wherever it applies.
    const classes = sel => (sel.match(/\.[a-zA-Z0-9_-]+/g) || []).length;
    assert.ok(classes(override[1]) > classes(base[1]),
        `the override (${classes(override[1])} classes) does not outrank the base (${classes(base[1])}); every cloud tile would stay rose`);
});

// ── 4. the count says what MPI-853 already settled next door ─────────────────────────────

test('the subtitle does not count cloud models as installed', () => {
    assert.match(PICKER, /const cloudN = _models\.filter\(m => m\.provider\)\.length;/,
        'the picker must separate cloud models from the installed count, as the library does');
    assert.match(PICKER, /\$\{_models\.length - cloudN\} installed/,
        'the installed count must subtract the cloud models — none of them was ever downloaded');
    assert.match(PICKER, /: `\$\{_models\.length\} installed`/,
        'with no key saved there are no cloud models; that line must read exactly as before');
});

test('no hardcoded hex reached the new rules', () => {
    const block = SHEET_CSS.slice(SHEET_CSS.indexOf('.mpi-tile__flag--cloud'));
    const rules = block.slice(0, block.indexOf('}', block.indexOf('.mpi-tile--video')) + 1);
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/, 'colours are CSS vars here, never hex');
});
