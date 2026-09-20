/**
 * js/utils/dom.js — Lightweight DOM utilities for Cubric Studio.
 * Import these instead of writing querySelector boilerplate.
 */

'use strict';

/**
 * Shorthand for querySelector. Scopes to document if root is omitted.
 * @param {string} sel - CSS selector
 * @param {Element|Document} [root=document]
 * @returns {Element|null}
 */
// eslint-disable-next-line mpi/no-raw-dom-query -- this file defines the qs wrapper
export const qs = (sel, root = document) => root.querySelector(sel);

/**
 * Shorthand for querySelectorAll, returns Array (not NodeList).
 * @param {string} sel - CSS selector
 * @param {Element|Document} [root=document]
 * @returns {Element[]}
 */
// eslint-disable-next-line mpi/no-raw-dom-query -- this file defines the qsa wrapper
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Shorthand for getElementById.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
// eslint-disable-next-line mpi/no-raw-dom-query -- this file defines the gid wrapper
export const gid = (id) => document.getElementById(id);

/**
 * Convenience addEventListener. Returns a cleanup function.
 * @param {EventTarget} el
 * @param {string} event
 * @param {Function} fn
 * @param {AddEventListenerOptions} [opts]
 * @returns {Function} cleanup — call to remove the listener
 */
export const on = (el, event, fn, opts) => {
    el.addEventListener(event, fn, opts);
    return () => el.removeEventListener(event, fn, opts);
};

/**
 * Convenience removeEventListener. Returns a re-add function.
 * @param {EventTarget} el
 * @param {string} event
 * @param {Function} fn
 * @param {AddEventListenerOptions} [opts]
 * @returns {Function} re-add — call to re-attach the listener
 */
export const off = (el, event, fn, opts) => {
    el.removeEventListener(event, fn, opts);
    return () => el.addEventListener(event, fn, opts);
};

/**
 * Shorthand for document.createElement with optional properties and children.
 * @param {string} tag
 * @param {Object} [props] - Properties to assign (e.g. { className, id, onclick })
 * @param {Array|Node|string} [children] - Child nodes, text, or an array of both
 * @returns {HTMLElement}
 * Usage:
const myBtn = ce('button', { 
    className: 'primary', 
    onclick: () => console.log('click') 
}, 'Click Me');
 */
export const ce = (tag, props, children) => {
    const el = document.createElement(tag);
    if (props) Object.assign(el, props);
    if (children) {
        if (Array.isArray(children)) el.append(...children.filter(Boolean));
        else el.append(children);
    }
    return el;
};

/**
 * Copies the nearest `[data-accent]` above `anchor` onto a node that has been
 * portalled to `document.body` (MPI-736).
 *
 * A portalled node inherits from `:root`, never from the thing that opened it, so
 * every picker's selected row drew the shared cream even when the workspace around
 * its trigger was orange. The attribute cannot be baked in at mount: the same
 * Dropdown primitive opens in five different workspaces, and a workspace can change
 * under a mounted component. So this is called at OPEN time, from the position/show
 * path, and re-reads the anchor every time.
 *
 * @param {HTMLElement} portalEl - The node living under document.body.
 * @param {HTMLElement} anchor   - The trigger still sitting in the real tree.
 */
export const inheritAccent = (portalEl, anchor) => {
    const accent = anchor?.closest?.('[data-accent]')?.dataset.accent;
    if (accent) portalEl.dataset.accent = accent;
    else delete portalEl.dataset.accent;
};

/** Vision's rose — what `--accent-heat` resolved to before the rebind engine existed. */
const ACCENT_HEAT_FALLBACK = 'oklch(0.76 0.17 355)';

/**
 * The live `--accent-heat` where `el` sits, as a colour a canvas draw can use (MPI-736).
 *
 * A `ctx.fillStyle` cannot hold a CSS var, so every stage overlay — crop handles, shape
 * handles, the brush ring, the negative mask dot — froze the rose as a literal. That was
 * right while the token WAS the rose; it is wrong now that `[data-accent]` rebinds it per
 * workspace (`styles/01_base.css`), because a crop handle in the video workspace kept
 * drawing pink over an orange UI.
 *
 * Pass the element the draw already has in hand — `ctx.canvas` in every call site here.
 * It must be READ at draw time, not baked: `navigation.js` changes the attribute on the
 * app shell above a canvas that stays mounted, exactly the staleness `inheritAccent`
 * exists to avoid.
 *
 * @param {Element} el - Any element inside the subtree whose accent is wanted.
 * @returns {string} A CSS colour; the rose when `el` is detached and computes nothing.
 */
// ponytail: one property read per draw, no cache. getComputedStyle only forces a recalc
// when styles are dirty, and these paths paint into a canvas rather than touch the DOM.
// Cache per element if a profile ever says otherwise — invalidating it needs an accent
// -change signal that does not exist yet.
export const accentHeat = (el) => {
    const live = el && getComputedStyle(el).getPropertyValue('--accent-heat').trim();
    return live || ACCENT_HEAT_FALLBACK;
};
