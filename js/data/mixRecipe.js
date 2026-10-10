/**
 * mixRecipe.js — pure schema definition, validator and helpers for the Mix
 * workspace recipe (MPI-917 Phase 1).
 *
 * Schema mix.v = 1:
 *
 *   videoLane: Array<{
 *     itemId: string,           // ITEM id (never a group id)
 *     in: number,               // trim in  (seconds into the source)
 *     out: number,              // trim out (seconds into the source)
 *     join: 'cut' | { crossfade: number },   // join to the NEXT clip; absent or 'cut' on the last
 *     linkedAudioClipId?: string             // clip id on the videoAudio track
 *   }>
 *
 *   tracks: Array<{
 *     id: string,
 *     name: string,
 *     kind: 'audio' | 'videoAudio',
 *     volumeDb: number,
 *     pan: number,              // [−1, 1]
 *     mute: boolean,
 *     solo: boolean,
 *     clips: Array<{
 *       id: string,
 *       itemId: string,         // ITEM id (never a group id)
 *       start: number,          // position on the timeline (seconds)
 *       in: number,             // trim in  (seconds into the source)
 *       out: number,            // trim out (seconds into the source)
 *       volumeDb: number,
 *       fadeIn: number,         // seconds (0 = no fade)
 *       fadeOut: number,        // seconds (0 = no fade)
 *       loop: boolean,
 *       linkedVideoIndex?: number   // index into videoLane when kind is videoAudio
 *     }>
 *   }>
 *
 *   master: { volumeDb: number }
 *
 * Clip references are always ITEM ids, never group ids — a group's selected
 * entry changes over time, so referencing the group would be ambiguous.
 *
 * DOM-free by construction: no imports, safe to require() from routes.
 */

export const MIX_SCHEMA_VERSION = 1;

const _TRACK_KINDS = ['audio', 'videoAudio'];

// ── validateMix ──────────────────────────────────────────────────────────────

/**
 * Validate a mix recipe.  Returns `{ ok: true, errors: [] }` when the shape is
 * correct, or `{ ok: false, errors: [{ code, message }, …] }` otherwise.
 * Every error has a named `code` so callers can respond to specific failures.
 *
 * @param {unknown} recipe
 * @returns {{ ok: boolean, errors: Array<{ code: string, message: string }> }}
 */
export function validateMix(recipe) {
    const errors = [];
    const err = (code, message) => errors.push({ code, message });

    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
        err('not-an-object', 'recipe must be a plain object');
        return { ok: false, errors };
    }

    if (recipe.v !== MIX_SCHEMA_VERSION) {
        err('bad-version', `recipe.v must be ${MIX_SCHEMA_VERSION}, got ${JSON.stringify(recipe.v)}`);
    }

    // ── videoLane ─────────────────────────────────────────────────────────────
    if (recipe.videoLane !== undefined) {
        if (!Array.isArray(recipe.videoLane)) {
            err('bad-video-lane', 'videoLane must be an array');
        } else {
            const lane = recipe.videoLane;
            lane.forEach((clip, i) => {
                if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
                    err('bad-video-clip', `videoLane[${i}] must be an object`);
                    return;
                }
                if (typeof clip.itemId !== 'string' || clip.itemId === '') {
                    err('bad-video-clip-item-id', `videoLane[${i}].itemId must be a non-empty string`);
                }
                if (typeof clip.in !== 'number' || !isFinite(clip.in)) {
                    err('bad-video-clip-in', `videoLane[${i}].in must be a finite number`);
                }
                if (typeof clip.out !== 'number' || !isFinite(clip.out)) {
                    err('bad-video-clip-out', `videoLane[${i}].out must be a finite number`);
                }
                if (clip.join !== undefined && clip.join !== 'cut') {
                    if (
                        typeof clip.join !== 'object' ||
                        Array.isArray(clip.join) ||
                        typeof clip.join.crossfade !== 'number' ||
                        !isFinite(clip.join.crossfade)
                    ) {
                        err('bad-video-clip-join',
                            `videoLane[${i}].join must be 'cut' or { crossfade: number }`);
                    } else {
                        // A crossfade on the last clip makes no sense — there is no next clip
                        if (i === lane.length - 1) {
                            err('video-crossfade-on-last',
                                `videoLane[${i}] is the last clip; it cannot have a crossfade join`);
                        } else {
                            // The crossfade must be shorter than both the clip it bridges
                            const thisDur = clip.out - clip.in;
                            const next = lane[i + 1];
                            const nextDur = (typeof next.out === 'number' && typeof next.in === 'number')
                                ? next.out - next.in
                                : Infinity;
                            if (clip.join.crossfade >= thisDur || clip.join.crossfade >= nextDur) {
                                err('video-crossfade-too-long',
                                    `videoLane[${i}].join.crossfade (${clip.join.crossfade}s) must be` +
                                    ` shorter than both adjacent clips`);
                            }
                        }
                    }
                }
            });
        }
    }

    // ── tracks ────────────────────────────────────────────────────────────────
    if (!Array.isArray(recipe.tracks)) {
        err('bad-tracks', 'tracks must be an array');
    } else {
        recipe.tracks.forEach((track, ti) => {
            if (!track || typeof track !== 'object' || Array.isArray(track)) {
                err('bad-track', `tracks[${ti}] must be an object`);
                return;
            }
            if (typeof track.id !== 'string' || track.id === '') {
                err('bad-track-id', `tracks[${ti}].id must be a non-empty string`);
            }
            if (typeof track.name !== 'string') {
                err('bad-track-name', `tracks[${ti}].name must be a string`);
            }
            if (!_TRACK_KINDS.includes(track.kind)) {
                err('bad-track-kind',
                    `tracks[${ti}].kind must be one of: ${_TRACK_KINDS.join(', ')}`);
            }
            if (typeof track.volumeDb !== 'number' || !isFinite(track.volumeDb)) {
                err('bad-track-volume', `tracks[${ti}].volumeDb must be a finite number`);
            }
            if (typeof track.pan !== 'number' || !isFinite(track.pan)) {
                err('bad-track-pan', `tracks[${ti}].pan must be a finite number`);
            }
            if (typeof track.mute !== 'boolean') {
                err('bad-track-mute', `tracks[${ti}].mute must be a boolean`);
            }
            if (typeof track.solo !== 'boolean') {
                err('bad-track-solo', `tracks[${ti}].solo must be a boolean`);
            }

            if (!Array.isArray(track.clips)) {
                err('bad-track-clips', `tracks[${ti}].clips must be an array`);
            } else {
                track.clips.forEach((clip, ci) => {
                    if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
                        err('bad-clip', `tracks[${ti}].clips[${ci}] must be an object`);
                        return;
                    }
                    if (typeof clip.id !== 'string' || clip.id === '') {
                        err('bad-clip-id',
                            `tracks[${ti}].clips[${ci}].id must be a non-empty string`);
                    }
                    if (typeof clip.itemId !== 'string' || clip.itemId === '') {
                        err('bad-clip-item-id',
                            `tracks[${ti}].clips[${ci}].itemId must be a non-empty string`);
                    }
                    if (typeof clip.start !== 'number' || !isFinite(clip.start)) {
                        err('bad-clip-start',
                            `tracks[${ti}].clips[${ci}].start must be a finite number`);
                    }
                    if (typeof clip.in !== 'number' || !isFinite(clip.in)) {
                        err('bad-clip-in',
                            `tracks[${ti}].clips[${ci}].in must be a finite number`);
                    }
                    if (typeof clip.out !== 'number' || !isFinite(clip.out)) {
                        err('bad-clip-out',
                            `tracks[${ti}].clips[${ci}].out must be a finite number`);
                    }
                    if (typeof clip.volumeDb !== 'number' || !isFinite(clip.volumeDb)) {
                        err('bad-clip-volume',
                            `tracks[${ti}].clips[${ci}].volumeDb must be a finite number`);
                    }
                    if (clip.fadeIn !== undefined) {
                        if (typeof clip.fadeIn !== 'number' || !isFinite(clip.fadeIn) || clip.fadeIn < 0) {
                            err('bad-clip-fade-in',
                                `tracks[${ti}].clips[${ci}].fadeIn must be a non-negative number`);
                        }
                    }
                    if (clip.fadeOut !== undefined) {
                        if (typeof clip.fadeOut !== 'number' || !isFinite(clip.fadeOut) || clip.fadeOut < 0) {
                            err('bad-clip-fade-out',
                                `tracks[${ti}].clips[${ci}].fadeOut must be a non-negative number`);
                        }
                    }
                });
            }
        });
    }

    // ── master ────────────────────────────────────────────────────────────────
    if (!recipe.master || typeof recipe.master !== 'object' || Array.isArray(recipe.master)) {
        err('bad-master', 'master must be an object');
    } else if (typeof recipe.master.volumeDb !== 'number' || !isFinite(recipe.master.volumeDb)) {
        err('bad-master-volume', 'master.volumeDb must be a finite number');
    }

    return { ok: errors.length === 0, errors };
}

// ── mixDuration ───────────────────────────────────────────────────────────────

/**
 * Total timeline duration of the mix in seconds.
 *
 * The video lane contributes the sum of its clip durations minus the sum of all
 * crossfade durations between adjacent clips.  A crossfade on the last clip is
 * invalid (validateMix rejects it) and is intentionally NOT subtracted here.
 * Track clips contribute their end time: `clip.start + (clip.out − clip.in)`.
 * Loop clips are treated as a single play-through for duration purposes.
 *
 * @param {{ videoLane?: Array, tracks?: Array }} recipe
 * @returns {number} Duration in seconds (≥ 0)
 */
export function mixDuration(recipe) {
    let dur = 0;

    if (Array.isArray(recipe.videoLane) && recipe.videoLane.length > 0) {
        let vd = 0;
        const lane = recipe.videoLane;
        for (let i = 0; i < lane.length; i++) {
            const clip = lane[i];
            vd += clip.out - clip.in;
            // Only subtract a crossfade when there IS a next clip to cross into
            if (i < lane.length - 1 &&
                clip.join && typeof clip.join === 'object' &&
                clip.join.crossfade > 0) {
                vd -= clip.join.crossfade;
            }
        }
        dur = Math.max(dur, vd);
    }

    if (Array.isArray(recipe.tracks)) {
        for (const track of recipe.tracks) {
            if (!Array.isArray(track.clips)) continue;
            for (const clip of track.clips) {
                dur = Math.max(dur, clip.start + (clip.out - clip.in));
            }
        }
    }

    return dur;
}

// ── resolveSolo ───────────────────────────────────────────────────────────────

/**
 * Compute the effective mute state for every track, accounting for solo.
 *
 * **Mute wins over solo:** a track that is both muted and soloed stays muted —
 * the mute button is a hard silence switch.  Its solo flag still arms the solo
 * group, so every OTHER non-solo track becomes effectively muted.
 *
 *   effectiveMute = track.mute || (hasSolo && !track.solo)
 *
 * When no track has `solo: true`, each track's `effectiveMute` equals its own
 * `mute` flag unchanged.
 *
 * Returns a new array; the original tracks are not mutated.
 *
 * @param {Array<{ mute: boolean, solo: boolean }>} tracks
 * @returns {Array<{ effectiveMute: boolean }>}
 */
export function resolveSolo(tracks) {
    const hasSolo = tracks.some(t => t.solo);
    return tracks.map(track => ({
        ...track,
        effectiveMute: track.mute || (hasSolo && !track.solo),
    }));
}
