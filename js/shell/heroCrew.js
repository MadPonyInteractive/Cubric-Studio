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

/**
 * Stage order, left to right. Position, size, accent and paint order live in the CSS.
 *
 * The labels carry the MASCOT NAMES (Fabio, 2026-09-22), mapped in MPI-846. That narrows
 * MPI-846's "chrome labels stay role nouns", which exists so nobody has to learn six
 * names to find a button — a crew label is identity, not a control, and the role line
 * under it still says what the character does.
 */
const CREW = Object.freeze([
    { key: 'prompt', name: 'Lingo', role: 'shapes the words' },
    { key: 'vision', name: 'Prism', role: 'makes the images' },
    { key: 'studio', name: 'Cosmo', role: 'runs the crew' },
    { key: 'video',  name: 'Reel',  role: 'puts them in motion' },
    { key: 'audio',  name: 'Vinyl', role: 'gives them sound' },
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

/**
 * While a RunPod pod connects, the crew leaves and Studio alone fights two cables in one
 * wide scene (docs/mascot-placement.md § The landing while a pod connects). The four
 * scenes play in turn; each opens and closes on the same frame, so they swap bare (Fabio,
 * 2026-09-25: a puff between them is pointless). None of them ever connects, so none lies
 * about the pod. `crew` is not a clip: it is the band's way of saying "show the crew", and
 * its long `ms` only re-paints that same state. The ONE transition is on success: a puff,
 * then `connected` plays once (lights on, arms up) and hands back to the crew. A failed
 * connect goes straight back, since Studio's 1:1 failed clip does not match this scene.
 */
const BAND_POOLS = Object.freeze({
    crew: { clips: ['crew'], nominalMs: 60000, loop: true },
    connecting: {
        clips: ['connecting-sparks', 'connecting-spit-out', 'connecting-laptop', 'connecting-screwdriver'],
        nominalMs: 8000, loop: true, pick: 'ordered',
    },
    connected: { clips: ['connected'], nominalMs: 5200 },
});
const CREW_CLIP = 'crew';
const CONNECTING = 'mpi-landing__crew--connecting';

/** Clips that were never rolled. Studio's second happy is i2v_015 (MPI-777, Fabio's). */
const MISSING_CLIPS = Object.freeze({ studio: ['happy-2'] });

/**
 * Transition overlays, one set per mascot, and the moment in each where the effect hides
 * the mascot most — the only frame at which the clip underneath can swap without a jump.
 * Measured per clip in `docs/mascot-transitions.md` § Picks; they are NOT derivable from
 * the file, so they are copied here and nowhere else.
 */
export const TRANSITIONS = Object.freeze({
    vision: { smoke: 583, explosion: 417, third: 375 },
    studio: { smoke: 583, explosion: 333, third: 333 },
    prompt: { smoke: 458, explosion: 375, third: 292 },
    audio:  { smoke: 542, explosion: 375, third: 292 },
    video:  { smoke: 583, explosion: 458, third: 458 },
});
/** Every transition is one H3 length: 22 frames at 24fps. */
export const TRANSITION_MS = 900;

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
/** The character, hidden while a transition covers his spot. See `_paintFx`. */
const GONE = 'mpi-landing__crew-member--vanished';

// Stage fit, in reference px (the 1120×1000 hero at a 1920×1032 window).
const STAGE_W = 1120;
const FLOOR_BAND = 160;   // hero kept under the floor for the labels and stats foot (landing.css)
const CLEAR_GAP = 16;     // between the text and the nearest head
const VISION_H = 260;     // the tallest character under the quote
const STUDIO_H = 360;     // the tallest character under the headline
// Label thresholds from the label widths measured 2026-09-15 (names 61-74px, role lines
// 86-125px) against the closest pair of characters (Video and Audio, 194 stage px apart),
// with a 12px gap. The mascot names that replaced the role nouns are all SHORTER than
// that measurement, so these stay conservative rather than needing a re-measure; the role
// lines, which are the wider half and set NAMES_MIN's neighbour, did not change.
// ponytail: re-measure if the label copy or font changes.
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
 * Hand a mascot from its live clip to the twin, both classes in one frame. The hidden
 * clip sits at opacity 0.001, not 0, so it is still drawn and shows its frame the moment
 * it goes live (landing.css `.mpi-landing__crew-clip`). At 0 it painted nothing for a
 * frame, and keeping the old clip up to cover that stacked two poses on a mid-clip swap
 * (hover, MPI-908). Also used by the agent panel's crew (MpiAgentChat.js) and the
 * generating card (MpiGalleryGrid.js).
 */
export function handOverClip(prev, next, live) {
    next.classList.add(live);
    prev.classList.remove(live);
    prev.pause();
}

/**
 * Swap the mascot's clip. Two stacked videos, because assigning `src` to the visible one
 * blanks it until the first frame decodes — five mascots blinking every few seconds. The
 * hidden one loads and starts, and only then do they trade places.
 */
function _paintClip(m, id) {
    // Off stage while a pod connects: its queue keeps time, but nothing decodes.
    if (m.parked) return;
    const next = m.shown === m.a ? m.b : m.a;
    const seq = ++m.seq;
    next.src = _clipSrc(m.key, id);
    m.el.classList.toggle(AWAKE, !id.startsWith('idle'));
    const show = () => {
        // A play() promise from a swap that has already been overtaken must not flip.
        if (m.dead || seq !== m.seq || m.shown === next) return;
        handOverClip(m.shown, next, LIVE);
        m.shown = next;
        // If a transition made him vanish, he comes back HERE — the queue calls this at
        // the overlay's densest moment, so he fades in under cover and is whole again as
        // the smoke clears, rather than popping in after it. A no-op on an ordinary swap.
        m.el.classList.remove(GONE);
    };
    // Reduced motion: the queue paints once and schedules nothing, so not playing leaves
    // the video holding its first frame — which is the rest frame every clip opens on.
    if (m.reduced) on(next, 'loadeddata', show, { once: true });
    // Flip on the first PRESENTED frame: play() resolves before any frame reaches the screen,
    // and flipping then blanks him for a frame (MpiAgentChat.js `_paintCosmo`, measured).
    else next.play().then(() => next.requestVideoFrameCallback(show), () => {});
}

/**
 * The transition layer above the mascot. `null` clears it.
 *
 * The character goes AT ONCE when the overlay starts and fades back in when the new clip
 * is live under it (`_paintClip`), so he reads as vanishing into the puff and re-forming
 * inside it — standing there while it goes off in front of him is what this replaced
 * (Fabio, 2026-09-22). Clearing also un-hides him, so a cleared overlay can never leave
 * an invisible mascot behind.
 */
function _paintFx(m, id) {
    if (!id) {
        m.el.classList.remove(GONE);
        m.fx.classList.remove(LIVE);
        m.fx.pause();
        m.fx.removeAttribute('src');
        m.fx.load();
        return;
    }
    m.el.classList.add(GONE);
    m.fx.src = _clipSrc(m.key, id);
    m.fx.classList.add(LIVE);
    m.fx.play().catch(() => {});
}

function _buildQueue(m, states = _statesFor(m.key), paint = id => _paintClip(m, id), rest = 'idle') {
    const byId = new Map();
    for (const def of Object.values(states)) for (const c of def.clips) byId.set(c.id, c);
    const transitions = Object.entries(TRANSITIONS[m.key]).map(([name, swapAtMs]) => ({
        id: `transition-${name}`, ms: TRANSITION_MS, swapAtMs,
    }));
    return createMascotClipQueue({
        states,
        transitions,
        rest,
        paint,
        paintTransition: id => _paintFx(m, id),
        // `crew` is the band's stand-in for "show the crew", not a file.
        preload: id => { if (id !== CREW_CLIP) _warm(m, id, byId.get(id)); },
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
    // a and b share a wrapper so the character can be hidden WITHOUT the overlay: the
    // puff has to take him with it (Fabio, 2026-09-22), and fx is its sibling, not its
    // child. Fading the two clips directly instead would turn every ordinary swap into
    // a crossfade, which is not what Phase 3 shipped.
    const body = ce('span', { className: 'mpi-landing__crew-body' }, [a, b]);
    const el = ce('figure', { className: `mpi-landing__crew-member mpi-landing__crew-member--${key}` }, [
        ce('span', { className: 'mpi-landing__crew-lift' }, ce('span', { className: 'mpi-landing__crew-float' }, [body, fx])),
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
 * Take the crew off stage under the connecting band, or bring it back. Parked members
 * hold still and paint nothing; back on stage each starts a fresh idle, so none resumes
 * a clip mid-pose.
 */
function _parkCrew(members, parked) {
    for (const m of members) {
        if (Boolean(m.parked) === parked) continue;
        m.parked = parked;
        if (parked) m.shown.pause();
        else m.queue.request('idle', { interrupt: true, transition: false });
    }
}

/** The band's paint: a connecting scene hides the crew (landing.css), `crew` brings it back. */
function _paintBand(band, id) {
    const connecting = id !== CREW_CLIP;
    band.stage.classList.toggle(CONNECTING, connecting);
    _parkCrew(band.members, connecting);
    if (connecting) { _paintClip(band, id); return; }
    band.seq++;   // a scene still waiting for its first frame must not flip back in
    band.shown.pause();
    band.shown.classList.remove(LIVE);
}

/**
 * The connecting band: one wide scene across the stage, two stacked clips like a member,
 * and a transition layer placed exactly where Studio's own is, so the success
 * puff lands on him.
 */
function _buildBand(stage, members) {
    const clip = (extra = '') => ce('video', {
        className: `mpi-landing__crew-band-clip${extra}`, muted: true, playsInline: true, preload: 'auto',
    });
    const a = clip();
    const b = clip();
    const fx = ce('video', { className: 'mpi-landing__crew-clip mpi-landing__crew-fx', muted: true, playsInline: true, preload: 'auto' });
    const el = ce('div', { className: 'mpi-landing__crew-band' }, [
        ce('span', { className: 'mpi-landing__crew-body' }, [a, b]),
        ce('span', { className: 'mpi-landing__crew-band-spot' }, fx),
    ]);
    const band = { key: 'studio', el, a, b, fx, shown: a, seq: 0, warm: [], dead: false, reduced: _reducedMotion(), stage, members, queue: null };
    const states = {};
    for (const [name, { clips, nominalMs, ...def }] of Object.entries(BAND_POOLS)) {
        states[name] = { ...def, clips: clips.map(id => ({ id, ms: nominalMs })) };
    }
    band.queue = _buildQueue(band, states, id => _paintBand(band, id), CREW_CLIP);
    return band;
}

/**
 * Follow the pod: the band takes the stage while it connects, the crew has it otherwise.
 * Reduced motion skips `connected`: its queue schedules nothing, so a play-once scene
 * would hold the stage for good.
 */
function _syncConnecting(connecting, connected = false) {
    if (!_crew || connecting === _crew.connecting) return;
    _crew.connecting = connecting;
    const next = connecting ? 'connecting' : (connected && !_crew.band.reduced ? 'connected' : CREW_CLIP);
    _crew.band.queue.request(next, { interrupt: true, transition: next === 'connected' });
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
    const stage = root.closest('.mpi-landing__crew');
    const band = _buildBand(stage, members);
    const cleanups = [
        Events.onState('screenClear', _syncHold),
        // The emit, not `state.remoteEnginePhase`: only the payload says whether the
        // connect that just ended succeeded.
        Events.on('remote:connection', ({ connected = false, phase = null } = {}) =>
            _syncConnecting(phase === 'connecting', connected)),
    ];
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
    root.appendChild(band.el);

    // Refit on a window resize (the hero) and on a quote that wraps differently.
    const observer = new ResizeObserver(() => _fit());
    const quote = qs('.mpi-landing__quote', hero);
    _crew = {
        root, stage, hero, h1: qs('.mpi-landing__headline h1', hero), quote,
        members, band, connecting: false, cleanups, ambient: 0, observer,
    };
    // Same task as the append, so the entrance never gets a frame before the hold decides.
    _syncHold();
    // Landing mid-connect (back from a project while the pod still boots): the band is already up.
    _syncConnecting(state.remoteEnginePhase === 'connecting');
    observer.observe(hero);
    observer.observe(quote);
}

function _destroy() {
    if (!_crew) return;
    _crew.observer.disconnect();
    clearInterval(_crew.ambient);
    // Every queue MUST die here: its timer chain re-arms itself for ever, so one survivor
    // keeps the crew running behind an open project and hangs a test run with no output.
    for (const m of [..._crew.members, _crew.band]) {
        m.dead = true;
        m.queue.destroy();
        // Hiding a playing video keeps its decoder; only this releases it. The warm clips
        // are detached and never played, but they hold buffered data just the same.
        for (const v of [...m.warm, m.a, m.b, m.fx]) { v.pause(); v.removeAttribute('src'); v.load(); }
        m.warm.length = 0;
    }
    _crew.cleanups.forEach(fn => fn());
    // The stage is static markup and outlives the crew; the next mount decides afresh.
    _crew.stage.classList.remove(CONNECTING);
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
