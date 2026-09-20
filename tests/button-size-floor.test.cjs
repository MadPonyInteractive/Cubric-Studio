/**
 * MPI-845 — a button that asks to be shorter than its size token must say so twice.
 *
 * MPI-822 (`ddd813da`, "one height per control size, app-wide") put
 * `min-height: var(--control-h-*)` on `.mpi-btn--sm/md/lg`. Its comment reasoned that
 * "icon buttons are unchanged, text buttons grow to meet them — nothing shrinks". That was
 * true for every call site that took the default height and false for the five that had
 * deliberately shrunk below it: a size floor clamps the USED height after the cascade, so a
 * call site's `height: 16px` loses no matter how specific its selector is. Nothing warned.
 * Fabio found it by eye weeks later — the remove X on a reference-image chip had become a
 * 16x34 tab.
 *
 * This is the guard for the whole class, not for that one chip. A rule that sizes a button
 * below its token is fine — it just has to release the floor with `min-height` in the same
 * rule, which is also what makes the intent readable.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/** styles/01_base.css — the floor MPI-822 applies per size class. */
const TOKENS = { sm: 34, md: 50, lg: 62 };
/** ComponentFactory defaults a button with no size class to `sm`. */
const DEFAULT_FLOOR = TOKENS.sm;

function cssFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === 'engine' || e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) cssFiles(full, out);
        else if (e.name.endsWith('.css')) out.push(full);
    }
    return out;
}

/** The rule's subject — the right-most compound, after any descendant/child combinator. */
function subject(selector) {
    return selector.trim().split(/[\s>+~]+/).pop();
}

/** Does this rule size the BUTTON, rather than a child of it (an icon, an img, a spinner)? */
function targetsTheButton(sel) {
    const last = subject(sel);
    if (last.includes('::')) return false;
    // `.mpi-ibtn__icon` / `__img` / `__spinner` are children; `.mpi-ibtn--rail` is the button.
    return /(^|\.)mpi-(btn|ibtn)(--[a-z0-9-]+)?(\.|:|$)/.test(last)
        && !/\.mpi-(btn|ibtn)__/.test(last);
}

function floorFor(sel) {
    for (const [size, px] of Object.entries(TOKENS)) {
        if (sel.includes(`--${size}`)) return px;
    }
    return DEFAULT_FLOOR;
}

test('no button is sized below its size token without releasing min-height', () => {
    const offenders = [];
    for (const file of [...cssFiles(path.join(ROOT, 'js')), ...cssFiles(path.join(ROOT, 'styles'))]) {
        const flat = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            const sel = m[1].trim();
            if (sel.startsWith('@') || !targetsTheButton(sel)) continue;

            const height = /(?:^|;)\s*height\s*:\s*([0-9.]+)px/m.exec(m[2]);
            if (!height) continue;
            const floor = floorFor(sel);
            if (Number(height[1]) >= floor) continue;

            // `min-height` in the same rule is the opt-out: 0, or any value it means.
            if (/(?:^|;)\s*min-height\s*:/m.test(m[2])) continue;

            offenders.push(
                `${path.relative(ROOT, file)}\n      ${sel.replace(/\s+/g, ' ')}\n`
                + `      height: ${height[1]}px is clamped to ${floor}px by MPI-822's size floor; `
                + 'add `min-height: 0` to opt out.',
            );
        }
    }
    assert.deepStrictEqual(
        offenders, [],
        `${offenders.length} button rule(s) render taller than they ask:\n\n  ${offenders.join('\n\n  ')}\n`,
    );
});

test('the size floor itself is still in place — this guard is not a licence to drop it', () => {
    // If MPI-822's floor is ever removed, the test above starts passing vacuously. Pin it.
    const css = fs.readFileSync(
        path.join(ROOT, 'js/components/Primitives/MpiButton/MpiButton.css'), 'utf8');
    for (const size of Object.keys(TOKENS)) {
        assert.match(
            css, new RegExp(`\\.mpi-btn--${size}\\s*\\{[^}]*min-height:\\s*var\\(--control-h-${size}\\)`),
            `.mpi-btn--${size} lost its min-height floor — MPI-822 exists to keep one height per size.`,
        );
    }
});
