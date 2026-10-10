'use strict';

// MPI-1047 — sync-raw-workflows dirty-generated guard.
//
// Before the fix the guard fired BEFORE knowing what changed, so a plain raw
// edit (which never triggers orchestrate.py) was blocked by an unrelated
// peer's dirty generated file. Hit twice on MPI-936 (2026-10-08).
//
// The fix moves the guard after the changed-set is computed and makes it
// conditional: a template change (or --all) triggers a global orchestrate.py
// rebuild → guard ALL dirty generated files; a plain raw edit only writes its
// own specific output path → guard only that path.
//
// blockingDirtyLines is the extracted pure helper. Tests drive it directly —
// no git calls, no disk I/O.

const assert = require('node:assert/strict');
const { test, before } = require('node:test');

// blockingDirtyLines is exported from the ESM script; load it once.
let blockingDirtyLines;
before(async () => {
  ({ blockingDirtyLines } = await import('../scripts/sync-raw-workflows.mjs'));
});

// ---------------------------------------------------------------------------
// Helpers — stub git-status lines and a path resolver that returns predictable
// relative paths without touching the filesystem.
// ---------------------------------------------------------------------------

/** Build a fake git-status --porcelain line for a generated (non-raw) path. */
const dirtyLine = (relPath) => ` M ${relPath}`;

/**
 * Stub pathFor: plain raw → comfy_workflows/<name>
 *              template  → comfy_workflows/scripts/workflow_generation/<name>
 */
function stubPathFor(basename) {
  const lc = basename.toLowerCase();
  return /_template\.json$/i.test(lc)
    ? `comfy_workflows/scripts/workflow_generation/${lc}`
    : `comfy_workflows/${lc}`;
}

// ---------------------------------------------------------------------------
// (a) Plain raw edit — unrelated generated file dirty → NOT blocked
//
//   Peer's card has comfy_workflows/flow_character_sheet_edit.json dirty.
//   Our change: plain raw edit of scene_path_video.json (no template).
//   Expected: blockingDirtyLines returns [] → run is allowed.
// ---------------------------------------------------------------------------

test('plain raw edit: unrelated dirty generated file does NOT block', () => {
  const peerDirtyLine = dirtyLine('comfy_workflows/flow_character_sheet_edit.json');
  const changedNames = ['scene_path_video.json'];   // plain raw, not a template
  const result = blockingDirtyLines([peerDirtyLine], changedNames, false, stubPathFor);
  assert.deepEqual(result, [], 'should return no blockers');
});

test('plain raw edit: multiple unrelated dirty generated files do NOT block', () => {
  const dirty = [
    dirtyLine('comfy_workflows/flow_character_sheet_edit.json'),
    dirtyLine('comfy_workflows/scripts/workflow_generation/ltx_video_template.json'),
  ];
  const changedNames = ['my_workflow.json'];   // plain raw
  const result = blockingDirtyLines(dirty, changedNames, false, stubPathFor);
  assert.deepEqual(result, [], 'no blockers when output path is unrelated');
});

// ---------------------------------------------------------------------------
// (b) Template raw edit — any dirty generated file blocks (global rebuild)
//
//   Peer's card has comfy_workflows/flow_character_sheet_edit.json dirty.
//   Our change: ltx_video_template.json (a _template).
//   Expected: blockingDirtyLines returns the peer's dirty line → run is refused.
// ---------------------------------------------------------------------------

test('template raw edit: any dirty generated file IS a blocker (global rebuild)', () => {
  const peerDirtyLine = dirtyLine('comfy_workflows/flow_character_sheet_edit.json');
  const changedNames = ['ltx_video_template.json'];   // _template → orchestrate.py runs
  const result = blockingDirtyLines([peerDirtyLine], changedNames, false, stubPathFor);
  assert.deepEqual(result, [peerDirtyLine], 'peer dirty file blocks a template sync');
});

test('template raw edit: blocks on multiple dirty generated files', () => {
  const dirty = [
    dirtyLine('comfy_workflows/flow_character_sheet_edit.json'),
    dirtyLine('comfy_workflows/scripts/workflow_generation/ltx_video_template.json'),
  ];
  const changedNames = ['scene_path_video_template.json'];
  const result = blockingDirtyLines(dirty, changedNames, false, stubPathFor);
  assert.deepEqual(result, dirty, 'all dirty generated lines are blockers');
});

// ---------------------------------------------------------------------------
// (c) Plain raw edit whose OWN output is dirty → blocked
//
//   OUR output comfy_workflows/scene_path_video.json is dirty (peer or prior run).
//   Our change: scene_path_video.json (plain raw).
//   Expected: blockingDirtyLines returns that one line → run is refused.
// ---------------------------------------------------------------------------

test('plain raw edit: dirty OWN output path IS a blocker', () => {
  const ownDirtyLine = dirtyLine('comfy_workflows/scene_path_video.json');
  const changedNames = ['scene_path_video.json'];
  const result = blockingDirtyLines([ownDirtyLine], changedNames, false, stubPathFor);
  assert.deepEqual(result, [ownDirtyLine], 'own output being dirty must block');
});

test('plain raw edit: own output dirty while unrelated file also dirty — only own blocks', () => {
  const ownDirtyLine = dirtyLine('comfy_workflows/my_workflow.json');
  const peerDirtyLine = dirtyLine('comfy_workflows/flow_character_sheet_edit.json');
  const changedNames = ['my_workflow.json'];
  const result = blockingDirtyLines([ownDirtyLine, peerDirtyLine], changedNames, false, stubPathFor);
  assert.deepEqual(result, [ownDirtyLine], 'only own output path should appear in blockers');
});

// ---------------------------------------------------------------------------
// (d) --all (force) flag — any dirty generated file blocks regardless
// ---------------------------------------------------------------------------

test('--all flag: any dirty generated file IS a blocker regardless of template status', () => {
  const peerDirtyLine = dirtyLine('comfy_workflows/flow_character_sheet_edit.json');
  const changedNames = ['my_workflow.json'];   // plain raw, but --all
  const result = blockingDirtyLines([peerDirtyLine], changedNames, true /* force */, stubPathFor);
  assert.deepEqual(result, [peerDirtyLine], '--all is a global rebuild, must block');
});

// ---------------------------------------------------------------------------
// (e) Edge cases
// ---------------------------------------------------------------------------

test('empty dirty list → never blocks regardless of template', () => {
  const changedNames = ['ltx_video_template.json'];
  const result = blockingDirtyLines([], changedNames, false, stubPathFor);
  assert.deepEqual(result, []);
});

test('empty changed list + force → returns all dirty lines', () => {
  const dirty = [dirtyLine('comfy_workflows/a.json'), dirtyLine('comfy_workflows/b.json')];
  const result = blockingDirtyLines(dirty, [], true, stubPathFor);
  assert.deepEqual(result, dirty);
});

test('empty changed list + no force → no blockers', () => {
  const dirty = [dirtyLine('comfy_workflows/a.json')];
  const result = blockingDirtyLines(dirty, [], false, stubPathFor);
  assert.deepEqual(result, []);
});

test('case-insensitive template detection: _TEMPLATE.json counts as a template', () => {
  const peerDirtyLine = dirtyLine('comfy_workflows/flow_character_sheet_edit.json');
  // isTemplate checks /_template\.json$/i — uppercase should still match
  const changedNames = ['LTX_Video_TEMPLATE.json'];
  const result = blockingDirtyLines([peerDirtyLine], changedNames, false, stubPathFor);
  assert.deepEqual(result, [peerDirtyLine], 'uppercase _TEMPLATE should trigger global guard');
});

test('git-status lines with quoted paths are parsed correctly (space in path)', () => {
  // git --porcelain quotes paths with spaces: ' M "comfy_workflows/my flow.json"'
  const ownDirtyLine = ' M "comfy_workflows/my flow.json"';
  const changedNames = ['my flow.json'];
  // Custom pathFor that handles the space
  const pathFor = (f) => `comfy_workflows/${f.toLowerCase()}`;
  const result = blockingDirtyLines([ownDirtyLine], changedNames, false, pathFor);
  assert.deepEqual(result, [ownDirtyLine], 'quoted paths in dirty lines should be matched');
});
