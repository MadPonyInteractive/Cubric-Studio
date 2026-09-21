'use strict';

/**
 * paid-models-section.test.cjs — MPI-853.
 *
 * The Model Library is a renderer component with a live dep cache, a download service and
 * an overlay behind it, so what it LOOKS like is Fabio's check, not a unit test's. What a
 * unit test can hold are the four places this section has to exist in, each of which
 * disappears silently when it is wrong:
 *
 *   1. It must be rendered from BOTH call sites. The second one is inside the
 *      "nothing matched" branch, so missing it hides the whole section behind any search
 *      that matches no LOCAL model — which is most searches, once a user types a cloud
 *      model's name.
 *   2. Cloud models must be out of the counts, in the library head AND in the hero stat.
 *      Nothing about them is installed or installable, so a machine that added one is not
 *      suddenly "9 installed", and a library that lists one is not "15 available".
 *   3. The drawer must offer no action. "Uninstall" on a model that was never downloaded
 *      is the one Fabio named; "Install" is worse, because `_install` returns immediately
 *      for a model with no dependencies, so the click does nothing at all, silently.
 *   4. Every shipped cloud model must produce real price copy. A tile whose chip reads
 *      "price unknown" is a model we are inviting someone to spend money on without
 *      telling them how much.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { MODELS } = require('../js/data/modelConstants/models.js');
const { estimateCost, formatPrice } = require('../js/data/modelConstants/deepinfraPricing.js');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const MANAGER = read('js', 'components', 'Organisms', 'MpiModelManager', 'MpiModelManager.js');
const HERO = read('js', 'shell', 'heroStats.js');
const TILE_CSS = read('js', 'components', 'Primitives', 'MpiTileSheet', 'MpiTileSheet.css');

const CLOUD = MODELS.filter(m => m.provider);

// ── 1. both call sites ───────────────────────────────────────────────────────────────────

test('the section renders from both call sites, including the empty-search branch', () => {
    const calls = MANAGER.match(/^\s*_paidSection\(\);/gm) || [];
    assert.equal(calls.length, 2,
        `_paidSection() is called ${calls.length} time(s); it needs the normal render AND the "nothing matched" branch`);

    // The one in the empty branch must come before that branch returns, or it never runs.
    const emptyBranch = MANAGER.slice(MANAGER.indexOf('No models match'), MANAGER.indexOf('_section(\'Installed\''));
    assert.match(emptyBranch, /_paidSection\(\);/,
        'the empty-search branch returns without rendering the cloud section');
});

test('it renders AFTER the local sections — the foot of the library, like third-party flows', () => {
    const installed = MANAGER.indexOf("_section('Installed'");
    const available = MANAGER.indexOf("_section('Available'");
    const paid = MANAGER.lastIndexOf('_paidSection();');
    assert.ok(installed > 0 && available > installed && paid > available,
        'section order is literal call order; the cloud section must come last');
});

// ── 2. the counts ────────────────────────────────────────────────────────────────────────

test('the library head counts LOCAL models on both halves', () => {
    assert.match(MANAGER, /const localModels = MODELS\.filter\(m => !_isPaid\(m\)\);/,
        'the count line no longer separates local models from cloud ones');
    const countLine = MANAGER.slice(MANAGER.indexOf('const totalInstalled'), MANAGER.indexOf('if (!visible.length)'));
    assert.match(countLine, /localModels\.filter\(isInstalled\)/, 'the installed half counts every model');
    assert.match(countLine, /localModels\.length - totalInstalled/, 'the available half counts every model');
    assert.ok(!/MODELS\.length - totalInstalled/.test(countLine), 'the denominator is still the whole registry');
});

test('the hero stat counts local models on both halves too', () => {
    assert.match(HERO, /MODELS\.filter\(m => !m\.provider\)\.length/, 'the hero denominator includes cloud models');
    assert.match(HERO, /\.provider\)\.length\)\)\);/, 'the hero numerator does not filter the models:checked payload');
});

// ── 3. the drawer, and the tile ──────────────────────────────────────────────────────────

test('a cloud model gets no footer action at all', () => {
    const footer = MANAGER.slice(MANAGER.indexOf("detailActions.innerHTML = ''"),
        MANAGER.indexOf('_detailActionBtns.push(install)'));
    assert.match(footer, /if \(_isPaid\(model\)\) \{/,
        'the footer does not branch on a cloud model, so it offers Install or Uninstall');
    // The paid branch must come FIRST: `anyInstalled` is true for a cloud model whose key
    // is saved, and that branch is the one that renders "Uninstall".
    assert.ok(footer.indexOf('_isPaid(model)') < footer.indexOf('st.anyInstalled'),
        'the cloud branch must precede the installed branch, which renders Uninstall');
});

test('the tile is built without the install state machine', () => {
    const item = MANAGER.slice(MANAGER.indexOf('function _paidTileItem'), MANAGER.indexOf('// ── Render the contact sheet'));
    assert.ok(!/_modelState\(/.test(item),
        '_paidTileItem calls _modelState, whose fallthrough renders an Install chip that does nothing');
    assert.match(item, /mpi-tile__chip--paid/, 'the tile does not use the paid chip');
    assert.ok(!/chip--available/.test(item), '--available draws a download arrow on something that never downloads');
});

test('the paid chip has its own style and does not borrow the download one', () => {
    assert.match(TILE_CSS, /\.mpi-tile__chip--paid \{/, 'no .mpi-tile__chip--paid rule');
    const rule = TILE_CSS.slice(TILE_CSS.indexOf('.mpi-tile__chip--paid {'));
    assert.match(rule, /var\(--[a-z0-9-]+\)/, 'the chip hardcodes a colour instead of a token');
});

test('saving a key repaints the section — it is in the list signature', () => {
    const sig = MANAGER.slice(MANAGER.indexOf('function _listSignature'), MANAGER.indexOf('##plugins:'));
    assert.match(sig, /##paid:\$\{hasCloudKey\(\) \? 1 : 0\}/,
        'the signature ignores the key, so the section keeps telling a user with a key that they need one');
});

// ── 4. every shipped cloud model can say what it costs ───────────────────────────────────

test('every cloud model produces real price copy for its tile', () => {
    assert.ok(CLOUD.length > 0, 'no cloud model ships');
    for (const model of CLOUD) {
        // A per-second clip model cannot price itself from nothing, and `estimateCost`
        // is right to return null rather than guess (MPI-850). The tile therefore quotes
        // a stated representative clip for those — the `_paidQuote` contract in
        // MpiModelManager — while an image model must still answer from nothing. What
        // may never happen is a paid tile reading "price unknown".
        const quote = model.mediaType === 'video'
            ? (estimateCost(model.cloud.endpointId)
                || estimateCost(model.cloud.endpointId,
                    { duration: 5, resolution: '1080p', width: 1920, height: 1080 }))
            : estimateCost(model.cloud.endpointId);
        assert.ok(quote, `${model.id} cannot be priced from ${model.cloud.endpointId}`);
        assert.match(quote.display, /^about \$\d/, `${model.id} price copy reads "${quote.display}"`);
    }
});

test('the price chip is coloured by what the price BUYS', () => {
    // DESIGN.md "colour states what a surface is ABOUT": Vision rose for an image model,
    // Video orange for a clip one. Fabio, 2026-09-21, on seeing fifteen cloud tiles all
    // wearing rose. Asserted on the SOURCE because the alternative is a screenshot.
    assert.match(MANAGER, /mpi-tile__chip--paid-video/,
        'the tile no longer distinguishes a clip model from an image one');
    assert.match(MANAGER, /model\.mediaType === 'video'\s*\?\s*' mpi-tile__chip--paid-video'/,
        'the video modifier must key on mediaType, not on the price or the op');

    const sheet = read('js', 'components', 'Primitives', 'MpiTileSheet', 'MpiTileSheet.css');
    assert.match(sheet, /\.mpi-tile__chip--paid\s*\{[^}]*--vision-accent/,
        'the base paid chip must stay Vision rose, so paid FLOWS are unaffected');
    assert.match(sheet, /\.mpi-tile__chip--paid-video\s*\{[^}]*--video-accent/,
        'the video chip must use the family token, never a hex or a color-mix');
});

test('a sub-cent model quotes a figure, not a shrug', () => {
    // "under $0.01" on a tile does not answer the question a user is actually asking,
    // which is whether a batch of four is worth it.
    assert.equal(formatPrice(0.0005), 'about $0.0005');
    const schnell = MODELS.find(m => m.id === 'flux-schnell-cloud');
    assert.equal(estimateCost(schnell.cloud.endpointId).display, 'about $0.0005');
});
