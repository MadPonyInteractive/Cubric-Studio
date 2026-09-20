/**
 * MPI-845 — the breadcrumb chips do not take a background on hover.
 *
 * Fabio, 2026-09-20: hovering "GALLERY" in a history workspace, or "PROJECTS" in the gallery,
 * filled the chip; Flows and Record beside them did not. The cause was never a missing rule —
 * it was a specificity loss. `.mpi-project-name__back` declares `background: none` at (0,1,0)
 * and MpiButton's `.mpi-btn--ghost:hover:not(:disabled)` fills `--surface-2` at (0,3,0), so
 * the component's opt-out never outranked the primitive. The icon-button ghost pins
 * `background: transparent` on hover deliberately, which is the only reason the neighbours
 * looked right.
 *
 * A text scan would not catch this coming back: the `background: none` line can still be
 * present and still lose. So this resolves the cascade for real over one synthetic element —
 * every rule in both stylesheets that could match the chip on hover, highest specificity
 * wins — and asserts the winner is not a fill.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BUTTON_CSS = path.join(ROOT, 'js/components/Primitives/MpiButton/MpiButton.css');
const CHIP_CSS = path.join(ROOT, 'js/components/Compounds/MpiProjectName/MpiProjectName.css');

/** The pseudo-classes these chips actually carry while hovered. */
const LIVE_PSEUDOS = new Set([':hover', ':not(:disabled)']);

/** Strip comments, then yield { selector, decls } for every top-level rule. */
function rules(css) {
    const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(flat))) {
        const selector = m[1].trim();
        if (!selector || selector.startsWith('@')) continue;
        out.push({ selector, decls: m[2] });
    }
    return out;
}

/** (classes + pseudo-classes), with :not() contributing its argument. Ids/elements unused here. */
function specificity(compound) {
    const notArgs = [...compound.matchAll(/:not\(([^)]*)\)/g)].map((x) => x[1]);
    const bare = compound.replace(/:not\([^)]*\)/g, '');
    let n = (bare.match(/\.[A-Za-z0-9_-]+/g) || []).length
          + (bare.match(/(?<!:):[A-Za-z-]+/g) || []).length;
    for (const a of notArgs) n += specificity(a);
    return n;
}

/** Does this single compound selector match an element with `classes`, in the given state? */
function matches(compound, classes) {
    if (/[\s>+~]/.test(compound.replace(/:not\([^)]*\)/g, ''))) return false;   // combinators
    const wanted = compound.match(/\.[A-Za-z0-9_-]+/g) || [];
    if (!wanted.every((c) => classes.has(c.slice(1)))) return false;
    const pseudos = [
        ...(compound.match(/:not\([^)]*\)/g) || []),
        ...(compound.replace(/:not\([^)]*\)/g, '').match(/(?<!:):[A-Za-z-]+/g) || []),
    ];
    return pseudos.every((p) => LIVE_PSEUDOS.has(p));
}

/** Last declaration of `prop` in a rule body, or null. */
function decl(decls, prop) {
    const hits = [...decls.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'g'))];
    return hits.length ? hits[hits.length - 1][1].trim() : null;
}

/** Resolve `prop` for an element carrying `classes`, over the given stylesheets in order. */
function resolve(files, classes, prop) {
    let best = null;
    for (const file of files) {
        for (const rule of rules(fs.readFileSync(file, 'utf8'))) {
            for (const compound of rule.selector.split(',').map((s) => s.trim())) {
                if (!matches(compound, classes)) continue;
                const value = decl(rule.decls, prop);
                if (value === null) continue;
                const spec = specificity(compound);
                // Later file, equal specificity -> later wins, same as the cascade.
                if (!best || spec >= best.spec) best = { spec, value, compound, file };
            }
        }
    }
    return best;
}

// MpiButton.css loads before the component's own sheet, which is the real load order.
const SHEETS = [BUTTON_CSS, CHIP_CSS];

const CHIPS = {
    'back chip (← GALLERY / ← PROJECTS)':
        ['mpi-btn', 'mpi-btn--ghost', 'mpi-project-name__back'],
    'breadcrumb link segment':
        ['mpi-btn', 'mpi-btn--ghost', 'mpi-project-name__segment', 'mpi-project-name__segment--link'],
};

for (const [name, classList] of Object.entries(CHIPS)) {
    test(`${name} takes no background on hover`, () => {
        const won = resolve(SHEETS, new Set(classList), 'background');
        assert.ok(won, `no background rule matched the ${name} at all`);
        assert.match(
            won.value, /^(transparent|none)$/,
            `${name} resolves to \`background: ${won.value}\` from \`${won.compound}\`. `
            + 'A ghost chip must not fill on hover — see MPI-845.',
        );
    });
}

test('the fix is a specificity win, not a deleted primitive rule', () => {
    // The primitive still fills for ordinary text ghosts; that behaviour is correct and must
    // stay. If someone "fixes" MPI-845 by gutting MpiButton instead, this fails.
    const ordinary = resolve([BUTTON_CSS], new Set(['mpi-btn', 'mpi-btn--ghost']), 'background');
    assert.strictEqual(
        ordinary && ordinary.value, 'var(--surface-2)',
        'a plain text ghost button should still fill on hover — MPI-845 is a local opt-out, '
        + 'not a change to MpiButton.',
    );
});

test('the icon ghost neighbours (Flows, Record) were never the bug', () => {
    const icon = resolve(SHEETS, new Set(['mpi-btn', 'mpi-ibtn', 'mpi-btn--ghost']), 'background');
    assert.strictEqual(
        icon && icon.value, 'transparent',
        'the icon ghost pins background:transparent on hover; that is why Flows and Record '
        + 'looked right while the text-only chips did not.',
    );
});
