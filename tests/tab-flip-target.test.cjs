// MPI-378 made Tab the workspace flipper; MPI-811 gave it back to the radial, whose
// "Latest Workspace" leg is the same resolver and whose dimmed state is the same null.
// Two things can break silently here:
//   1. resolveFlipTarget — the whole "offer nothing at all" contract lives in its
//      return of null. A wrong branch navigates to a card that isn't there.
//   2. The Tab handover itself — Hotkeys.bind() on an id that is no longer in the
//      registry logs a warning and returns a no-op, so a half-done handover leaves
//      Tab dead with nothing thrown anywhere.

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const group = (id, type = 'image') => ({ id, type });

test('resolveFlipTarget', async () => {
    const { resolveFlipTarget } = await import('../js/data/projectModel.js');

    // Nothing to flip to — Tab must do nothing at all.
    assert.equal(resolveFlipTarget(null), null);
    assert.equal(resolveFlipTarget({ itemGroups: [] }), null);

    // Exactly one card = the only thing Tab could mean, remembered or not.
    assert.equal(resolveFlipTarget({ itemGroups: [group('a')] }), 'a');
    assert.equal(resolveFlipTarget({ itemGroups: [group('a')], lastGroupId: 'gone' }), 'a');

    // Many cards: only the remembered one, and only while it still exists.
    const many = [group('a'), group('b'), group('c')];
    assert.equal(resolveFlipTarget({ itemGroups: many, lastGroupId: 'b' }), 'b');
    assert.equal(resolveFlipTarget({ itemGroups: many, lastGroupId: 'deleted' }), null);
    assert.equal(resolveFlipTarget({ itemGroups: many }), null);
    assert.equal(resolveFlipTarget({ itemGroups: many, lastGroupId: null }), null);

    // The gallery refuses to open audio groups as a history workspace, so the
    // radial must not offer one either — including the single-card shortcut.
    assert.equal(resolveFlipTarget({ itemGroups: [group('a', 'audio')] }), null);
    assert.equal(resolveFlipTarget({ itemGroups: [group('a', 'audio'), group('b')] }), 'b');
});

test('Tab is bound to the radial and nothing still binds the dead flipper id', () => {
    const registry = read('js/managers/hotkeyRegistry.js');
    assert.match(registry, /id:\s*'radialMenu\.toggle'/, 'radialMenu.toggle missing from the registry');
    assert.ok(!registry.includes("'workspace.flip'"), 'workspace.flip should be gone');
    // Ctrl+Tab dev ring is explicitly out of scope and must survive.
    assert.match(registry, /id:\s*'radialMenu\.devToggle'/);

    const radial = read('js/components/Primitives/MpiRadialMenu/MpiRadialMenu.js');
    assert.match(radial, /Hotkeys\.bind\('radialMenu\.toggle'/, 'the radial must bind bare Tab');
    assert.match(radial, /Hotkeys\.bind\('radialMenu\.devToggle'/);

    // MPI-811, 2026-09-19: overlays no longer gate Tab — the radial is the app's
    // selector and must reach out of the Flow Library and the Model Library too. A
    // MODAL still blocks: it is a question waiting on an answer, not a place.
    const entry = registry.slice(registry.indexOf("id:               'radialMenu.toggle'"));
    const when = entry.slice(entry.indexOf('when:'), entry.indexOf('},'));
    assert.ok(when.includes(".mpi-modal"), 'a modal must still block the radial');
    assert.ok(!when.includes('.mpi-overlay--body'), 'body overlays must NOT block the radial');

    const nav = read('js/shell/navigation.js');
    assert.ok(!nav.includes('workspace.flip'), 'navigation must not bind the dead flipper');
    // Every page destination closes what is open rather than navigating behind it.
    assert.match(nav, /Overlays\.closeTopOverlay\(\)/);
    // MPI-811's four destinations, and the dimming resolver behind the last one.
    for (const action of ['gallery', 'models', 'flows', 'workspace']) {
        assert.match(nav, new RegExp(`action:\\s*'${action}'`), `radial item '${action}' missing`);
    }
    assert.match(nav, /disabled:\s*!resolveFlipTarget/);
});

test('clear-on-delete lives in the service, not at the removeGroup call sites', () => {
    const service = read('js/services/projectService.js');
    assert.match(service, /lastGroupId: null/, 'removeGroup must clear the remembered card');

    // Four call sites; a fix patched into any of them is bypassable.
    for (const p of [
        'js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js',
        'js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js',
    ]) {
        assert.ok(!read(p).includes('lastGroupId'), `${p} must not touch lastGroupId`);
    }
});
