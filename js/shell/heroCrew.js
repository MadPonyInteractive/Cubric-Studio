/**
 * heroCrew.js — The landing hero's mascot crew (MPI-766, study A "Stage Call").
 *
 * Five characters stand on a lit stage across the bottom of the hero, Studio centre.
 * Layout, entrance and float are CSS (`styles/shell/landing.css`, `.mpi-landing__crew*`);
 * this module builds the members, drives their clips, owns the ambient greeting, fits the
 * stage into whatever room the window leaves under the headline, and holds the entrance
 * until the screen is clear (`state.screenClear`, js/shell/screenClearService.js).
 *
 * The landing is never unmounted — navigation only toggles `.hide` on #page-landing — so
 * the crew follows the PAGE instead: it mounts when `currentPage` becomes landing and is
 * destroyed when it stops being landing. Destroy releases every timer, listener, observer
 * and decoder, so nothing of the crew keeps running behind an open project.
 *
 * ANIMATED SINCE MPI-777 PHASE 3. Each member owns a `createMascotClipQueue`
 * (js/utils/mascotClipQueue.js), which decides WHICH clip plays and WHEN it swaps; this
 * file only paints. The clips are alpha VP9 WebM staged by `scripts/stage-mascot-clips.mjs`
 * at `assets/mascot/{key}/{state}.webm` — a `<video>`, not an `<img>`, and not a GIF: an
 * animated GIF of five mascots costs ~305 MiB of GPU texture memory at this draw size,
 * alpha VP9 is software-decoded and measured ~13 MiB (MPI-777, 2026-09-21).
 */

import { Events } from '../events.js';
import { state } from '../state.js';
import { PAGE_LANDING } from '../router.js';
import { gid, qs, qsa, ce, on } from '../utils/dom.js';
import { createMascotClipQueue } from '../utils/mascotClipQueue.js';

/** Stage order, left to right. Position, size, accent and paint order live in the CSS. */
const CREW = Object.freeze([
    { key: 'prompt', name: 'Prompt', role: 'shapes the words' },
    { key: 'vision', name: 'Vision', role: 'makes the images' },
    { key: 'studio', name: 'Studio', role: 'runs the crew' },
    { key: 'video',  name: 'Video',  role: 'puts them in motion' },
    { key: 'audio',  name: 'Audio',  role: 'gives them sound' },
]);

/**
 * The landing's three states. `nominalMs` is only what the queue runs on until the real
 * duration arrives (see `_warm`): the clips are not all the same length, and the numbers
 * differ per mascot.
 */
const POOLS = Object.freeze({
    idle:  { clips: ['idle-1', 'idle-2', 'idle-3'], nominalMs: 5200, loop: true },
    greet: { clips: ['greet-1', 'greet-2'], nominalMs: 3000 },
    happy: { clips: ['happy-1', 'happy-2'], nominalMs: 3000 },
});

/** Clips that were never rolled. Studio's second happy is i2v_015 (MPI-777, Fabio's). */
const MISSING_CLIPS = Object.freeze({ studio: ['happy-2'] });

/**
 * Transition overlays, one set per mascot, and the moment in each where the effect hides
 * the mascot most — the only frame at which the clip underneath can swap without a jump.
 * Measured per clip in `docs/mascot-transitions.md` § Picks; they are NOT derivable from
 * the file, so they are copied here and nowhere else.
 */
const TRANSITIONS = Object.freeze({
    vision: { smoke: 583, explosion: 417, third: 375 },
    studio: { smoke: 583, explosion: 333, third: 333 },
    prompt: { smoke: 458, explosion: 375, third: 292 },
    audio:  { smoke: 542, explosion: 375, third: 292 },
    video:  { smoke: 583, explosion: 458, third: 458 },
});
/** Every transition is one H3 length: 22 frames at 24fps. */
const TRANSITION_MS = 900;

/**
 * Added to every measured duration. The queue's clock and the decoder are not the same
 * clock; a timer that fires a few ms early would cut the last frames — which are the rest
 * frame the next clip opens on, so it would show as exactly the jump the queue prevents.
 */
const CLIP_PAD_MS = 60;

const GREET_EVERY_MS = 3200;
const AWAKE = 'mpi-landing__crew-member--awake';
const HELD = 'mpi-landing__crew--held';
const LIVE = 'mpi-landing__crew-clip--live';

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
 * The clip slot — the ONLY code that knows a mascot file. `{state}` is a pool entry
 * (`idle-2`, `greet-1`) or a transition (`transition-smoke`); both live in the same folder.
 */
function _clipSrc(key, clip) {
    return `assets/mascot/${key}/${clip}.webm`;
}

function _reducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** This mascot's pools, minus anything that was never rolled. */
function _statesFor(key) {
    const missing = MISSING_CLIPS[key] || [];
    const states = {};
    for (const [name, pool] of Object.entries(POOLS)) {
        states[name] = {
            clips: pool.clips.filter(id => !missing.includes(id)).map(id => ({ id, ms: pool.nominalMs })),
            loop: Boolean(pool.loop),
        };
    }
    return states;
}

/**
 * Warm one clip, and — for a pooled clip — write its REAL length into the object the
 * queue times against. The lengths differ per clip AND per mascot (idle-1 5.1s, idle-3
 * 4.1s), which is 40 hand-copied numbers that a re-encode would silently invalidate. The
 * queue re-reads `clip.ms` every time it enters a state, so writing it here is enough and
 * the nominal value only ever covers the first few hundred ms.
 */
function _warm(m, id, clip) {
    const v = ce('video', { preload: 'auto', muted: true, src: _clipSrc(m.key, id) });
    if (clip) {
        on(v, 'loadedmetadata', () => {
            if (v.duration) clip.ms = Math.round(v.duration * 1000) + CLIP_PAD_MS;
        }, { once: true });
    }
    m.warm.push(v);
}

/**
 * Swap the mascot's clip. Two stacked videos, because assigning `src` to the visible one
 * blanks it until the first frame decodes — five mascots blinking every few seconds. The
 * hidden one loads and starts, and only then do they trade places.
 */
function _paintClip(m, id) {
    const next = m.shown === m.a ? m.b : m.a;
    const seq = ++m.seq;
    next.src = _clipSrc(m.key, id);
    m.el.classList.toggle(AWAKE, !id.startsWith('idle'));
    const show = () => {
        // A play() promise from a swap that has already been overtaken must not flip.
        if (m.dead || seq !== m.seq || m.shown === next) return;
        next.classList.add(LIVE);
        m.shown.classList.remove(LIVE);
        m.shown.pause();
        m.shown = next;
    };
    // Reduced motion: the queue paints once and schedules nothing, so not playing leaves
    // the video holding its first frame — which is the rest frame every clip opens on.
    if (m.reduced) on(next, 'loadeddata', show, { once: true });
    else next.play().then(show, () => {});
}

/** The transition layer above the mascot. `null` clears it. */
function _paintFx(m, id) {
    if (!id) {
        m.fx.classList.remove(LIVE);
        m.fx.pause();
        m.fx.removeAttribute('src');
        m.fx.load();
        return;
    }
    m.fx.src = _clipSrc(m.key, id);
    m.fx.classList.add(LIVE);
    m.fx.play().catch(() => {});
}

function _buildQueue(m) {
    const states = _statesFor(m.key);
    const byId = new Map();
    for (const def of Object.values(states)) for (const c of def.clips) byId.set(c.id, c);
    const transitions = Object.entries(TRANSITIONS[m.key]).map(([name, swapAtMs]) => ({
        id: `transition-${name}`, ms: TRANSITION_MS, swapAtMs,
    }));
    return createMascotClipQueue({
        states,
        transitions,
        rest: 'idle',
        paint: id => _paintClip(m, id),
        paintTransition: id => _paintFx(m, id),
        preload: id => _warm(m, id, byId.get(id)),
        reducedMotion: m.reduced,
    });
}

function _buildMember({ key, name, role }) {
    const clip = (extra = '') => ce('video', {
        className: `mpi-landing__crew-clip${extra}`, muted: true, playsInline: true, preload: 'auto',
    });
    const a = clip(` ${LIVE}`);
    const b = clip();
    const fx = clip(' mpi-landing__crew-fx');
    // No alt text on the clips: the figcaption below carries the same name and role, and
    // the `<img>` this replaced only ever duplicated it.
    const el = ce('figure', { className: `mpi-landing__crew-member mpi-landing__crew-member--${key}` }, [
        ce('span', { className: 'mpi-landing__crew-lift' }, ce('span', { className: 'mpi-landing__crew-float' }, [a, b, fx])),
        ce('figcaption', { className: 'mpi-landing__crew-label' }, [
            ce('b', { className: 'mpi-landing__crew-name' }, name),
            ce('span', { className: 'mpi-landing__crew-role' }, role),
        ]),
    ]);
    // Random float phase, so five 4s cycles never bob in unison.
    el.style.setProperty('--crew-phase', `${-Math.random() * 4}s`);
    const m = { key, el, a, b, fx, shown: a, seq: 0, warm: [], dead: false, hovered: false, reduced: _reducedMotion(), queue: null };
    m.queue = _buildQueue(m);
    return m;
}

/**
 * One character greets every few seconds. It WAITS for the current idle clip to end —
 * only a hover or a click is urgent enough to cut one short. Reduced motion gets none
 * (returns 0).
 */
function _startAmbient(members) {
    if (_reducedMotion()) return 0;
    return setInterval(() => {
        const resting = members.filter(m => !m.hovered && m.queue.current().state === 'idle');
        const m = resting[Math.floor(Math.random() * resting.length)];
        if (m) m.queue.request('greet');
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
            // Both cut the current clip short — neither can wait up to 5s behind an idle —
            // but only the click gets a transition (Fabio, 2026-09-22): a puff of smoke every
            // time the pointer crosses a character is a bang where a greet should just happen.
            on(m.el, 'pointerenter', () => { m.hovered = true; m.queue.request('greet', { interrupt: true, transition: false }); }),
            on(m.el, 'pointerleave', () => { m.hovered = false; }),
            on(m.el, 'click', () => m.queue.request('happy', { interrupt: true })),
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
    // Every queue MUST die here: its timer chain re-arms itself for ever, so one survivor
    // keeps the crew running behind an open project and hangs a test run with no output.
    for (const m of _crew.members) {
        m.dead = true;
        m.queue.destroy();
        // Hiding a playing video keeps its decoder; only this releases it. The warm clips
        // are detached and never played, but they hold buffered data just the same.
        for (const v of [...m.warm, m.a, m.b, m.fx]) { v.pause(); v.removeAttribute('src'); v.load(); }
        m.warm.length = 0;
    }
    _crew.cleanups.forEach(fn => fn());
    for (const v of qsa('video', _crew.root)) { v.pause(); v.removeAttribute('src'); v.load(); }
    _crew.root.replaceChildren();
    _crew = null;
}

/** Called once at boot. The crew follows the landing page for the app's lifetime. */
export function initHeroCrew() {
    const sync = (page) => (page === PAGE_LANDING ? _mount() : _destroy());
    Events.onState('currentPage', sync);
    sync(state.currentPage);
}
