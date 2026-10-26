// Fills {{i:name}} with the app's own icon paths (js/utils/icons.js) and {{R}} with the repo root.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const repo = 'C:/AI/Mpi/Cubric-Vision';
const { ICONS } = await import(pathToFileURL(join(repo, 'js/utils/icons.js')).href);
const src = readFileSync(join(dirname(new URL(import.meta.url).pathname.slice(1)), 'phone.tpl.html'), 'utf8');
const out = join(repo, '.agents/mpi-kanban/tasks/MPI-1300/research/mockups/phone.html');

const missing = new Set();
const html = src
  .replaceAll('{{R}}', '../../../../../../')
  .replace(/\{\{i:([a-zA-Z0-9_]+)\}\}/g, (_, n) => {
    if (!ICONS[n]) { missing.add(n); return ''; }
    return `<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[n]}</svg>`;
  });
if (missing.size) { console.error('missing icons:', [...missing].join(', ')); process.exit(1); }
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log('wrote', out, html.length);
