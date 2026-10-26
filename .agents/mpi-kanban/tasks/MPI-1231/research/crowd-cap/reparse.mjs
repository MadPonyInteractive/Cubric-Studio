// Re-parses out.json's plan with the CURRENT parser (no model call): what would be drawn first,
// and each panel's prompt as the panel model gets it.
import fs from 'node:fs';
import path from 'node:path';
import { panelsWithDrawn, recurringActors, MAX_DRAWN_FIRST } from 'file:///C:/AI/Mpi/Cubric-Vision/js/services/storyboardRunner.js';

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const { plan } = JSON.parse(fs.readFileSync(`${HERE}/out.json`, 'utf8'));
const flat = plan.replace(/\r?\n/g, '');
const wanted = recurringActors(flat);
const drawn = wanted.slice(0, MAX_DRAWN_FIRST);
console.log('recurring:', wanted.map(a => `${a.name} (${a.kind})`).join(', '));
console.log('drawn first:', drawn.map(a => a.name).join(', '), '\n');
// No user pictures on this board; a place rides only the panels that name it (2026-10-26).
panelsWithDrawn(flat, '', drawn, 0)
    .forEach((p, i) => console.log(`[${i + 1}] refs: ${p.drawn.map(k => drawn[k].name).join(', ') || 'none'}\n${p.prompt}\n`));
