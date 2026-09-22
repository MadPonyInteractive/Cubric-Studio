/**
 * js/utils/mascotClipQueue.js — one mascot slot's clip queue (MPI-777 Phase 2).
 *
 * A "slot" is one mascot bound to one element: the landing crew has five, the agent
 * panel ledge has two, a toast has one. Each owns a set of STATES (idle, working,
 * greet…), each state a pool of clips. This module decides WHICH clip plays and
 * WHEN it swaps; it never touches a pixel. The caller's `paint` does that, so the
 * same queue drives a still, a GIF or an alpha WebM without knowing which — the
 * format decision (MPI-777 Settled vs its 2026-09-20 drift note) is still open and
 * this must not depend on it.
 *
 * DRIVEN BY A DURATION CLOCK, NEVER A MEDIA `ended` EVENT. This is load-bearing, not
 * a shortcut: a GIF in an `<img>` cannot report that it ended, so an `ended` design
 * would work only if the format decision went one way, and would silently foreclose
 * the other. Every clip declares its own `ms`, which is the only timing input.
 *
 * WHY SWAPS WAIT. Every state clip of a mascot opens and closes on the same rest
 * frame (MPI-78), so swapping at a clip's END never jumps and swapping mid-clip
 * always does. A request therefore waits by default. A request that cannot wait
 * would otherwise sit up to 5s behind an idle, so it INTERRUPTS.
 *
 * AN INTERRUPT COMES IN TWO STRENGTHS, and the caller picks (Fabio, 2026-09-22).
 * With a transition, a ~1s overlay plays at once on a layer above, the mascot swaps
 * underneath at the overlay's densest moment, and the overlay clears onto the new
 * clip — it hides the mid-clip jump completely, but it is a bang, so it belongs on a
 * deliberate act like a click. `transition: false` cuts straight to the new clip and
 * accepts the jump: for a hover, landing on the greet immediately reads better than
 * a puff of smoke every time the pointer crosses a character.
 */

'use strict';

/**
 * @typedef {{ id: string, ms: number }} Clip
 * @typedef {{ clips: Clip[], pick?: 'random'|'ordered', loop?: boolean }} StateDef
 * @typedef {Clip & { swapAtMs: number }} Transition
 */

/**
 * @param {object} o
 * @param {Record<string, StateDef>} o.states - pools by state name.
 * @param {Transition[]} [o.transitions] - interrupt overlays; one is picked at random.
 * @param {string} [o.rest='idle'] - the state a play-once clip hands back to.
 * @param {(clipId: string) => void} o.paint - show this clip. The ONLY pixel-facing hook.
 * @param {(clipId: string|null) => void} [o.paintTransition] - overlay layer; null clears it.
 * @param {(clipId: string) => void} [o.preload] - called once per clip at construction.
 * @param {boolean} [o.reducedMotion] - show a first frame and never schedule anything.
 * @returns {{ request: (state: string, opts?: { interrupt?: boolean, transition?: boolean }) => void,
 *            current: () => { state: string, clip: string|null, pending: string|null },
 *            destroy: () => void }}
 */
export function createMascotClipQueue({
    states,
    transitions = [],
    rest = 'idle',
    paint,
    paintTransition = () => {},
    preload,
    reducedMotion = false,
} = {}) {
    if (!states || !states[rest]) throw new Error(`mascotClipQueue: no "${rest}" state to rest in`);

    const _timers = new Set();
    /** The current clip's own end timer, cancelled separately when an interrupt cuts it short. */
    let _clipTimer = 0;
    let _state = rest;
    let _clip = null;
    let _pending = null;
    /** The state an interrupt under a transition will enter at its swap, until it does. */
    let _incoming = null;
    let _swapTimer = 0;
    let _clearTimer = 0;
    let _dead = false;
    /** Last id played per state, so a random pool never repeats back to back. */
    const _last = Object.create(null);
    /** Cursor per ordered pool. */
    const _cursor = Object.create(null);

    // Preload every clip and every transition, so the first swap never shows a blank
    // frame. Cheap: the browser dedupes, and the set is small.
    if (preload) {
        for (const def of Object.values(states)) for (const c of def.clips) preload(c.id);
        for (const t of transitions) preload(t.id);
    }

    function _after(ms, fn) {
        const id = setTimeout(() => { _timers.delete(id); if (!_dead) fn(); }, ms);
        _timers.add(id);
        return id;
    }

    /** Pick the next clip of a state: ordered walks the pool, random never repeats back to back. */
    function _next(name) {
        const def = states[name];
        const pool = def.clips;
        if (pool.length === 1) return pool[0];
        if (def.pick === 'ordered') {
            const i = (_cursor[name] || 0) % pool.length;
            _cursor[name] = i + 1;
            return pool[i];
        }
        let c = pool[Math.floor(Math.random() * pool.length)];
        // A pool of 2+ can always offer something else, so this terminates.
        while (c.id === _last[name]) c = pool[Math.floor(Math.random() * pool.length)];
        return c;
    }

    /** Show a state's next clip and arm its end. Reduced motion paints and stops. */
    function _enter(name) {
        _state = name;
        const clip = _next(name);
        _last[name] = clip.id;
        _clip = clip.id;
        paint(clip.id);
        if (reducedMotion) return;
        _clipTimer = _after(clip.ms, _onClipEnd);
    }

    /**
     * A clip ended: a waiting request takes effect here — this is the ONLY moment a
     * swap is free of a jump. Otherwise a looping state draws again and a play-once
     * state hands back to rest.
     */
    function _onClipEnd() {
        _clipTimer = 0;
        const next = _pending || (states[_state].loop ? _state : rest);
        _pending = null;
        _enter(next);
    }

    function _interrupt(name, withTransition) {
        _pending = null;
        if (_clipTimer) { clearTimeout(_clipTimer); _timers.delete(_clipTimer); _clipTimer = 0; }
        // A newer interrupt wins over one still waiting for its swap, or that swap lands later.
        if (_swapTimer) { clearTimeout(_swapTimer); _timers.delete(_swapTimer); _swapTimer = 0; }
        _incoming = null;
        if (!withTransition || !transitions.length) { _enter(name); return; }
        const t = transitions[Math.floor(Math.random() * transitions.length)];
        _incoming = name;
        // An older overlay still up is replaced, and its clear must not cut this one short.
        if (_clearTimer) { clearTimeout(_clearTimer); _timers.delete(_clearTimer); }
        paintTransition(t.id);
        // The mascot swaps UNDER the overlay, at its densest moment; the overlay then
        // clears onto a clip already playing. Two timers, because the swap is not the end.
        _swapTimer = _after(t.swapAtMs, () => { _swapTimer = 0; _incoming = null; _enter(name); });
        _clearTimer = _after(t.ms, () => { _clearTimer = 0; paintTransition(null); });
    }

    _enter(rest);

    return {
        request(name, { interrupt = false, transition = true } = {}) {
            if (_dead) return;
            if (!states[name]) throw new Error(`mascotClipQueue: unknown state "${name}"`);
            if (reducedMotion) { _enter(name); return; }   // a still, whatever was asked for
            if (interrupt) { _interrupt(name, transition); return; }
            // Measured against the state an interrupt is about to enter, not the one it is
            // leaving: "click, then carry on thinking" must queue the thinking, not drop it.
            if (name === (_incoming || _state)) { _pending = null; return; }
            _pending = name;
        },
        current: () => ({ state: _state, clip: _clip, pending: _pending }),
        destroy() {
            _dead = true;
            for (const id of _timers) clearTimeout(id);
            _timers.clear();
            _clipTimer = 0;
        },
    };
}
