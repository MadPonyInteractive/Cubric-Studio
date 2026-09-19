/**
 * MPI-736 — the family accents are named in ONE place and reached through `--accent-heat`.
 *
 * This exists because `MpiSettings.css` kept `oklch(0.72 0.20 6 / 0.45)` — the stale Vision
 * pink — through the whole phase-1b sweep that removed every other pink literal, and nothing
 * noticed for weeks. A hardcoded hue does not just look wrong: it IGNORES the `[data-accent]`
 * rebind, so the surface holding it can never state its own subject (DESIGN.md § "The rule:
 * colour states what a surface is ABOUT"). That is the failure this pins.
 *
 * It matches the written-down VALUES, not a hue range, so the canvas viewer's cyan and the
 * memory monitor's blue — real status colours, not family accents — are not false positives.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/** The five family accents (styles/01_base.css) plus the stale pink they replaced. */
const FAMILY_LITERALS = [
    'oklch(0.78 0.028 80)',   // --hub-accent, cream
    'oklch(0.76 0.17 355)',   // --vision-accent, rose
    'oklch(0.88 0.13 102)',   // --prompt-accent, yellow
    'oklch(0.84 0.11 170)',   // --accent-audio, green
    'oklch(0.78 0.15 48)',    // --video-accent, orange
    'oklch(0.72 0.20 6',      // the stale Vision pink — no closing paren, it carried an alpha
];

/** `01_base.css` is where the five are DECLARED; everywhere else must reach them by token. */
const ALLOWED = new Set([path.join('styles', '01_base.css')]);

function cssFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) cssFiles(full, out);
        else if (e.name.endsWith('.css')) out.push(full);
    }
    return out;
}

test('no stylesheet hardcodes a family accent — they are reached through --accent-heat', () => {
    const offenders = [];
    for (const file of [...cssFiles(path.join(ROOT, 'js')), ...cssFiles(path.join(ROOT, 'styles'))]) {
        const rel = path.relative(ROOT, file);
        if (ALLOWED.has(rel)) continue;
        // Blank the COMMENTS before scanning: a comment quoting a literal to explain why it
        // was removed is the opposite of the bug. Blanking rather than deleting keeps every
        // newline, so the reported line number is still the real one. Testing a per-line
        // "starts with * " shape is not enough — this repo wraps comment bodies with a plain
        // indent and no leading star, and that is exactly what slipped through first.
        const text = fs.readFileSync(file, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
        text.split('\n').forEach((line, i) => {
            for (const lit of FAMILY_LITERALS) {
                if (line.includes(lit)) offenders.push(`${rel}:${i + 1} — ${lit}`);
            }
        });
    }
    assert.deepStrictEqual(offenders, [],
        `a family accent is named at the call site, so [data-accent] cannot reach it:\n${offenders.join('\n')}`);
});

test('a settings section that has a subject declares it; one that has none does not', () => {
    const src = fs.readFileSync(
        path.join(ROOT, 'js/components/Compounds/LandingPages/MpiSettings/MpiSettings.js'), 'utf8');
    // The section tag and its <h3> title are adjacent in the template, so pair them up.
    const sections = [...src.matchAll(
        /<section class="mpi-settings__section"([^>]*)>\s*<h3 class="mpi-settings__section-title">([^<]+)</g)]
        .map(m => ({ title: m[2].trim(), accent: /data-accent="([^"]+)"/.exec(m[1])?.[1] ?? null }));

    const byTitle = Object.fromEntries(sections.map(s => [s.title, s.accent]));
    assert.strictEqual(byTitle.Audio, 'audio', 'the Audio section must wear the Audio accent');
    assert.strictEqual(byTitle['Reuse Prompt'], 'prompt', 'Reuse Prompt is about text, so Prompt yellow');
    for (const title of ['App Behavior', 'Desktop Notifications', 'Display', 'External Connections']) {
        assert.strictEqual(byTitle[title], null,
            `${title} is about no media type, so it takes no accent and stays Studio cream`);
    }
});

test('the on-plate outline follows the accent, at the section rule\'s own 45%', () => {
    const css = fs.readFileSync(
        path.join(ROOT, 'js/components/Compounds/LandingPages/MpiSettings/MpiSettings.css'), 'utf8');
    const rule = /\.mpi-settings__plate--on\s*\{([^}]*)\}/.exec(css);
    assert.ok(rule, '.mpi-settings__plate--on must exist');
    assert.match(rule[1], /color-mix\(in oklch, var\(--accent-heat\) 45%, transparent\)/);
});
