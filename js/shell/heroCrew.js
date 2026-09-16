/**
 * heroCrew.js — The landing hero's mascot crew (MPI-766, study A "Stage Call").
 *
 * Five characters stand on a lit stage across the bottom of the hero, Studio centre.
 * Layout, entrance and float are CSS (`styles/shell/landing.css`, `.mpi-landing__crew*`);
 * this module builds the members, swaps their poses, owns the ambient greeting, fits the
 * stage into whatever room the window leaves under the headline, and holds the entrance
 * until the screen is clear (`state.screenClear`, js/shell/screenClearService.js).
 *
 * The landing is never unmounted — navigation only toggles `.hide` on #page-landing — so
 * the crew follows the PAGE instead: it mounts when `currentPage` becomes landing and is
 * destroyed when it stops being landing. Destroy releases every timer, listener and
 * observer, so nothing of the crew keeps running behind an open project.
 */

import { Events } from '../events.js';
import { state } from '../state.js';
import { PAGE_LANDING } from '../router.js';
import { gid, qs, qsa, ce, on } from '../utils/dom.js';

/** Stage order, left to right. Position, size, accent and paint order live in the CSS. */
const CREW = Object.freeze([
    { key: 'prompt', name: 'Prompt', role: 'shapes the words' },
    { key: 'vision', name: 'Vision', role: 'makes the images' },
    { key: 'studio', name: 'Studio', role: 'runs the crew' },
    { key: 'video',  name: 'Video',  role: 'puts them in motion' },
    { key: 'audio',  name: 'Audio',  role: 'gives them sound' },
]);

const POSES = ['idle', 'greet', 'happy'];
const GREET_EVERY_MS = 3200;
const GREET_FOR_MS = 1500;
const HAPPY_FOR_MS = 1400;
const AWAKE = 'mpi-landing__crew-member--awake';
const HELD = 'mpi-landing__crew--held';

// Stage fit, in reference px (the 1120×1000 hero at a 1920×1032 window).
const STAGE_W = 1120;
const FLOOR_BAND = 160;   // hero kept under the floor for the labels and stats foot (landing.css)
const CLEAR_GAP = 16;     // between the text and the nearest head
const VISION_H = 260;     // the tallest character under the quote
const STUDIO_H = 360;     // the tallest character under the headline
// Label thresholds from the label widths measured 2026-09-15 (names 61-74px, role lines
// 86-125px) against the closest pair of characters (Video and Audio, 194 stage px apart),
// with a 12px gap. ponytail: re-measure if the label copy or font changes.
const ROLES_MIN = 0.66;
const NAMES_MIN = 0.41;
const CREW_MIN = 0.25;    // below this there is no room worth drawing a crew in

/** @type {{ root: HTMLElement, stage: HTMLElement, hero: HTMLElement, h1: HTMLElement, quote: HTMLElement, members: Array<Object>, cleanups: Function[], ambient: number, observer: ResizeObserver } | null} */
let _crew = null;

/**
 * The pose slot — the ONLY code that knows a mascot file. The stills are placeholders:
 * animated alpha WebM loops replace them here, without touching the layout.
 */
function _poseSrc(key, pose) {
    return `assets/mascot/${key}/${pose}.webp`;
}

function _setPose(m, pose, ms) {
    clearTimeout(m.timer);
    m.timer = 0;
    m.img.src = _poseSrc(m.key, pose);
    m.el.classList.toggle(AWAKE, pose !== 'idle');
    if (ms) m.timer = setTimeout(() => _setPose(m, m.hovered ? 'greet' : 'idle'), ms);
}

function _buildMember({ key, name, role }) {
    const img = ce('img', { className: 'mpi-landing__crew-img', src: _poseSrc(key, 'idle'), alt: `${name}, ${role}`, draggable: false });
    const el = ce('figure', { className: `mpi-landing__crew-member mpi-landing__crew-member--${key}` }, [
        ce('span', { className: 'mpi-landing__crew-lift' }, ce('span', { className: 'mpi-landing__crew-float' }, img)),
        ce('figcaption', { className: 'mpi-landing__crew-label' }, [
            ce('b', { className: 'mpi-landing__crew-name' }, name),
            ce('span', { className: 'mpi-landing__crew-role' }, role),
        ]),
    ]);
    // Random float phase, so five 4s cycles never bob in unison.
    el.style.setProperty('--crew-phase', `${-Math.random() * 4}s`);
    return { key, el, img, timer: 0, hovered: false };
}

/** One character greets every few seconds. Reduced motion gets none (returns 0). */
function _startAmbient(members) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return setInterval(() => {
        const resting = members.filter(m => !m.hovered && !m.el.classList.contains(AWAKE));
        const m = resting[Math.floor(Math.random() * resting.length)];
        if (m) _setPose(m, 'greet', GREET_FOR_MS);
    }, GREET_EVERY_MS);
}

/**
 * Hold the entrance until the screen is clear. Held, it waits paused on its first frame;
 * a cover arriving mid-entrance pauses it where it is. The first release also starts the
 * ambient greeting, so the first wave is never spent behind a dialog.
 */
function _syncHold() {
    if (!_crew) return;
    const held = !state.screenClear;
    _crew.stage.classList.toggle(HELD, held);
    if (!held && !_crew.ambient) _crew.ambient = _startAmbient(_crew.members);
}

/**
 * Scale the stage to the room it has: never past the reference, never wider than the
 * hero, and small enough that Vision's head clears the quote and Studio's clears the
 * headline. Then drop the labels that would collide side by side. The CSS keeps the
 * floor FLOOR_BAND above the hero's bottom at every scale.
 */
function _fit() {
    const { hero, stage, h1, quote } = _crew;
    const box = hero.getBoundingClientRect();
    if (!box.width || !box.height) return;   // landing hidden
    const above = box.height - FLOOR_BAND - CLEAR_GAP;
    const k = Math.max(0, Math.min(
        1,
        box.width / STAGE_W,
        (above - (quote.getBoundingClientRect().bottom - box.top)) / VISION_H,
        (above - (h1.getBoundingClientRect().bottom - box.top)) / STUDIO_H,
    ));
    // On the HERO, not the stage: the agent slot beside the headline bounds itself by the
    // crew's head line, and it is the stage's sibling, so a var on the stage never reached it.
    hero.style.setProperty('--crew-k', k.toFixed(3));
    stage.classList.toggle('mpi-landing__crew--hidden', k < CREW_MIN);
    stage.classList.toggle('mpi-landing__crew--no-names', k < NAMES_MIN);
    stage.classList.toggle('mpi-landing__crew--no-roles', k < ROLES_MIN);
}

function _mount() {
    const root = gid('heroCrew');
    if (!root || _crew) return;
    const hero = root.closest('.mpi-landing__hero');

    const members = CREW.map(_buildMember);
    const cleanups = [Events.onState('screenClear', _syncHold)];
    for (const m of members) {
        cleanups.push(
            on(m.el, 'pointerenter', () => { m.hovered = true; _setPose(m, 'greet'); }),
            on(m.el, 'pointerleave', () => { m.hovered = false; _setPose(m, 'idle'); }),
            on(m.el, 'click', () => _setPose(m, 'happy', HAPPY_FOR_MS)),
        );
        root.appendChild(m.el);
    }

    // Refit on a window resize (the hero) and on a quote that wraps differently.
    const observer = new ResizeObserver(() => _fit());
    const quote = qs('.mpi-landing__quote', hero);
    _crew = {
        root, stage: root.closest('.mpi-landing__crew'), hero, h1: qs('.mpi-landing__headline h1', hero), quote,
        members, cleanups, ambient: 0, observer,
    };
    // Same task as the append, so the entrance never gets a frame before the hold decides.
    _syncHold();
    observer.observe(hero);
    observer.observe(quote);
}

function _destroy() {
    if (!_crew) return;
    _crew.observer.disconnect();
    clearInterval(_crew.ambient);
    for (const m of _crew.members) clearTimeout(m.timer);
    _crew.cleanups.forEach(fn => fn());
    // For the animated loops: hiding a playing video keeps its decoder, only this releases it.
    for (const v of qsa('video', _crew.root)) { v.pause(); v.removeAttribute('src'); v.load(); }
    _crew.root.replaceChildren();
    _crew = null;
}

/** Called once at boot. The crew follows the landing page for the app's lifetime. */
export function initHeroCrew() {
    // Warm the cache so the first hover or click swaps without a blank frame.
    for (const { key } of CREW) for (const pose of POSES) ce('img', { src: _poseSrc(key, pose) });

    const sync = (page) => (page === PAGE_LANDING ? _mount() : _destroy());
    Events.onState('currentPage', sync);
    sync(state.currentPage);
}
