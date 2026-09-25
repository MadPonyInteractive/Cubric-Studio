/**
 * js/utils/mascotLoop.js — one looping mascot clip for a spot that never swaps (MPI-908):
 * the empty states. A spot that swaps clips needs two stacked videos and heroCrew.js
 * `handOverClip`; one that loops a single clip for as long as it is on screen needs neither.
 *
 * Reduced motion holds the clip's first frame, which is its rest pose: no `autoplay`.
 *
 * CROP cuts the 620x620 staged frame down to the figure (`object-view-box`, measured as the
 * union of every frame's alpha box), so a spot sized to DESIGN.md's 64px cap shows a 64px
 * mascot rather than a 38px one in a mostly empty square. no-results was measured across all
 * five mascots, peek on Studio's only.
 * ponytail: re-measure if a clip is re-staged at another size (scripts/stage-mascot-clips.mjs).
 */

const CROP = Object.freeze({
    'no-results':   'inset(155px 95px 0 0)',
    peek:           'inset(436px 111px 0 96px)',
    'update-ready': 'inset(64px 83px 61px 83px)',
});

/**
 * @param {string} key - mascot folder: studio | vision | video | audio | prompt
 * @param {string} clip - staged clip name, e.g. `no-results`
 * @param {string} className - the spot's own BEM class, which sizes it
 * @param {{once?: boolean}} [opts] - `once`: play through one time and hold the last frame,
 *   which is the rest pose again, instead of looping. For a spot mounted as it shows (a dialog).
 * @returns {string} a `<video>` element as markup
 */
export function mascotLoop(key, clip, className, { once = false } = {}) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const crop = CROP[clip] ? ` style="object-view-box: ${CROP[clip]}"` : '';
    return `<video class="${className}" src="assets/mascot/${key}/${clip}.webm"${crop} muted${once ? '' : ' loop'} playsinline preload="auto"${still ? '' : ' autoplay'} aria-hidden="true"></video>`;
}
