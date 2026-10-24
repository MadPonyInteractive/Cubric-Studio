'use strict';

// MPI-1278 (Fabio, 2026-10-24): Cosmo starts FLUX.3 Klein on Turbo, the fast weight, and turns
// it off (the base model, ~4x slower) only when the user asks for more quality. Both texts the
// agent reads before it sets `turbo` are pinned here: the router guide (`guide:flux-3`, gated,
// so always read before a FLUX.3 generate) and the model's list_models note.

const test = require('node:test');
const assert = require('node:assert/strict');

const { guideEntries } = require('../services/agentCorpus.mjs');
const { opPriority } = require('../js/data/modelConstants/modelPriority.js');

const guide = guideEntries().find((e) => e.id === 'guide:flux-3').text();
const settings = guide.split('## Settings')[1].split('\n## ')[0];

test('guide:flux-3 sends turbo: true in Auto, people and photographs included', () => {
    assert.match(settings, /on \(default\)/);
    assert.match(settings, /In Auto, send `turbo: true`, people\s+and photographs included/);
    assert.match(settings, /In Ask first, offer Turbo as the default/);
    assert.doesNotMatch(guide, /Base is the one for photoreal people/);
});

test('guide:flux-3 turns turbo off only on a quality ask, never by a bigger tier', () => {
    assert.match(settings, /`turbo: false` only when the user asks for it: more quality, more natural skin/);
    assert.match(settings, /never a higher tier/);
    assert.match(guide, /Offer a rerun with `turbo: false`/);
    assert.doesNotMatch(guide, /Turbo is on\. Rerun with `turbo: false`/);
});

test('the flux3-klein list_models note starts on Turbo', () => {
    const note = opPriority('flux3-klein', 't2i')?.note || '';
    assert.match(note, /Start on Turbo/);
    assert.match(note, /only when the user asks for more quality/);
    // `edit` has its own note, which says nothing about turbo either way.
    assert.doesNotMatch(opPriority('flux3-klein', 'edit')?.note || '', /turbo: false/);
});
