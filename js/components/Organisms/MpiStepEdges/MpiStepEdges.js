import { ComponentFactory } from '../../factory.js';
import { setDisplaySrc, originalSize } from '../../../utils/displayImage.js';
import { resolveMediaUrl } from '../../../utils/mediaActions.js';
import { qs, on } from '../../../utils/dom.js';

/**
 * @typedef {Object} StepEdgesValue
 * @property {number} left   - % of image width repainted from the left edge (0–50)
 * @property {number} right  - % of image width repainted from the right edge (0–50)
 * @property {number} top    - % of image height repainted from the top edge (0–50)
 * @property {number} bottom - % of image height repainted from the bottom edge (0–50)
 *
 * NOTE: this typedef belongs in js/components/types.js — it lives here only because
 * MPI-623 holds that file. Move it there when MPI-623 completes.
 */

/**
 * @typedef {Object} StepEdgesProps
 * @property {{url?: string}|null} media
 * @property {StepEdgesValue|null}  value
 * @property {function(StepEdgesValue):void} [onChange]
 * @property {Object} [step]
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper functions — exported so tests can require() without a DOM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clamp one edge value to [0, 50].
 * @param {*} val
 * @returns {number}
 */
export function clampEdge(val) {
    const n = Number(val);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(50, n));
}

/**
 * The default value — 10 % on every side.
 * @returns {StepEdgesValue}
 */
export function defaultValue() {
    return { left: 10, right: 10, top: 10, bottom: 10 };
}

/**
 * Apply defaults and per-side clamping to an incoming value.
 * Because each side is clamped independently to ≤ 50, the pair sums
 * (left+right, top+bottom) are automatically ≤ 100.
 * @param {*} v
 * @returns {StepEdgesValue}
 */
export function normalizeValue(v) {
    const d = defaultValue();
    return {
        left:   clampEdge(v?.left   ?? d.left),
        right:  clampEdge(v?.right  ?? d.right),
        top:    clampEdge(v?.top    ?? d.top),
        bottom: clampEdge(v?.bottom ?? d.bottom),
    };
}

/**
 * The bands a run repaints: ONE answer for the pass planner and the result Tiles view.
 * The gizmo emits a value only once a handle is dragged, so an untouched step means what
 * it SHOWS (`defaultValue`); a caller with no gizmo (the agent) names a `direction` field.
 * @param {Partial<StepEdgesValue>|null|undefined} stepValue - the edges step's stored value
 * @param {'left-right'|'top-bottom'|'both'|null|undefined} direction
 * @returns {StepEdgesValue}
 */
export function edgesFor(stepValue, direction) {
    if (['left', 'right', 'top', 'bottom'].some(k => stepValue?.[k] != null)) return normalizeValue(stepValue);
    const d = defaultValue();
    if (direction === 'left-right') return { ...d, top: 0, bottom: 0 };
    if (direction === 'top-bottom') return { ...d, left: 0, right: 0 };
    return d;
}

/**
 * Which axes carry a non-zero band — drives which axes the Tiles preview repeats on.
 * @param {StepEdgesValue} v
 * @returns {{x: boolean, y: boolean}}
 */
export function axesFromValue(v) {
    return {
        x: (v?.left > 0) || (v?.right > 0),
        y: (v?.top  > 0) || (v?.bottom > 0),
    };
}

/**
 * CSS background-repeat + background-size for a given tile count and joined axes.
 *
 * n=1 or no joined axes → no-repeat (the single-picture view).
 * x only → repeat-x, tile is (100/n)% wide, full height.
 * y only → repeat-y, full width, (100/n)% tall.
 * both   → repeat,   (100/n)% × (100/n)%.
 *
 * @param {number} n    - tile count (1–4)
 * @param {{x:boolean, y:boolean}} axes
 * @returns {{repeat: string, size: string}}
 */
export function repeatFromTiles(n, axes) {
    if (n <= 1 || (!axes.x && !axes.y)) {
        return { repeat: 'no-repeat', size: '100% 100%' };
    }
    // Convert to string, stripping trailing zeros after 4 decimal places.
    const pct = `${+(100 / n).toFixed(4)}%`;
    if (axes.x && axes.y) {
        return { repeat: 'repeat',   size: `${pct} ${pct}` };
    }
    if (axes.x) {
        return { repeat: 'repeat-x', size: `${pct} 100%` };
    }
    return { repeat: 'repeat-y', size: `100% ${pct}` };
}

/**
 * Determine which axes carry a join — drives whether the Tiles slider appears in
 * the result pane and which axes the CSS repeat covers.
 *
 * Priority:
 *   1. stepValue present → axesFromValue(stepValue)  (run had a picture; left/right/top/bottom)
 *   2. direction string  → 'left-right' | 'top-bottom' | 'both'  (no-picture texture mode)
 *   3. neither           → no axes (slider stays hidden)
 *
 * @param {StepEdgesValue|null|undefined} stepValue
 * @param {'left-right'|'top-bottom'|'both'|null|undefined} direction
 * @returns {{x: boolean, y: boolean}}
 */
export function resultTileAxes(stepValue, direction) {
    if (stepValue != null) return axesFromValue(stepValue);
    if (direction === 'both')       return { x: true, y: true };
    if (direction === 'left-right') return { x: true, y: false };
    if (direction === 'top-bottom') return { x: false, y: true };
    return { x: false, y: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/** Screen-px hit-test tolerance around a handle line. */
const HANDLE_HIT_PX = 8;

/**
 * MpiStepEdges — the `edges` step kind (MPI-1101).
 *
 * Shows a picture with four draggable band handles — one per side.
 * Each handle is a line at `side%` of the image edge (in original-image
 * space) and controls how wide the repaint band will be on that side.
 * The tiled preview lives on the RESULT (`result.tiles`), not here: seams
 * can only be judged on what landed (Fabio, 2026-10-13).
 *
 * Contract (every step kind):
 *   props  { media, value, onChange, step, source, sourceValue }
 *   el.getValue() → StepEdgesValue
 *
 * @param {StepEdgesProps} props
 */
export const MpiStepEdges = ComponentFactory.create({
    name: 'MpiStepEdges',
    css: ['js/components/Organisms/MpiStepEdges/MpiStepEdges.css'],

    template: () => `
        <div class="mpi-step-edges">
            <div class="mpi-step-edges__stage" id="step-edges-stage">
                <canvas class="mpi-step-edges__canvas" id="step-edges-canvas"></canvas>
            </div>
        </div>`,

    setup: (el, props) => {
        const _unsubs = [];
        const stageEl  = qs('#step-edges-stage',  el);
        const canvasEl = /** @type {HTMLCanvasElement} */ (qs('#step-edges-canvas', el));
        const ctx = canvasEl.getContext('2d');

        /** Whether the source image has loaded. */
        let _loaded = false;
        /** Original image dimensions (handles are in original-px space). */
        let _natural = { w: 1, h: 1 };

        /** Screen-space view transform over original image space. */
        const view = { offsetX: 0, offsetY: 0, scale: 1 };

        /** Current edge values. */
        let _val = normalizeValue(props.value);

        /**
         * Which handle is being dragged.
         * @type {'left'|'right'|'top'|'bottom'|null}
         */
        let _dragging = null;

        // ── Colors (read CSS vars at first draw so we respect any theme changes) ──

        /** @type {string} */ let _accent = '';

        function _readAccent() {
            if (_accent) return _accent;
            _accent = getComputedStyle(el).getPropertyValue('--accent-heat').trim();
            return _accent;
        }

        // ── View transform ────────────────────────────────────────────────────

        /** Fit the image centered in the canvas, letterboxed. */
        function _refit() {
            const cw = canvasEl.width;
            const ch = canvasEl.height;
            if (cw <= 4 || ch <= 4 || !_loaded) return;
            const scale = Math.min(cw / _natural.w, ch / _natural.h);
            view.scale   = scale;
            view.offsetX = (cw - _natural.w * scale) / 2;
            view.offsetY = (ch - _natural.h * scale) / 2;
        }

        /** Canvas px (event-space) → original image px. */
        function _toImage(ev) {
            const r = canvasEl.getBoundingClientRect();
            return {
                x: ((ev.clientX - r.left) * (canvasEl.width  / r.width)  - view.offsetX) / view.scale,
                y: ((ev.clientY - r.top)  * (canvasEl.height / r.height) - view.offsetY) / view.scale,
            };
        }

        // ── Drawing ───────────────────────────────────────────────────────────

        const _imgEl = new Image();

        function _draw() {
            if (!ctx) return;
            const { width: cw, height: ch } = canvasEl;
            ctx.clearRect(0, 0, cw, ch);
            if (!_loaded) return;

            // Image
            ctx.drawImage(
                _imgEl,
                view.offsetX, view.offsetY,
                _natural.w * view.scale, _natural.h * view.scale,
            );

            const accent = _readAccent();
            const iw = _natural.w;
            const ih = _natural.h;
            const { left, right, top, bottom } = _val;

            // ── Band overlays ────────────────────────────────────────────────
            if (accent) ctx.fillStyle = accent;
            ctx.globalAlpha = 0.32;

            if (left > 0) {
                ctx.fillRect(
                    view.offsetX,
                    view.offsetY,
                    (left / 100) * iw * view.scale,
                    ih * view.scale,
                );
            }
            if (right > 0) {
                const w = (right / 100) * iw * view.scale;
                ctx.fillRect(
                    view.offsetX + iw * view.scale - w,
                    view.offsetY,
                    w,
                    ih * view.scale,
                );
            }
            if (top > 0) {
                ctx.fillRect(
                    view.offsetX,
                    view.offsetY,
                    iw * view.scale,
                    (top / 100) * ih * view.scale,
                );
            }
            if (bottom > 0) {
                const h = (bottom / 100) * ih * view.scale;
                ctx.fillRect(
                    view.offsetX,
                    view.offsetY + ih * view.scale - h,
                    iw * view.scale,
                    h,
                );
            }

            ctx.globalAlpha = 1;

            // ── Handle lines ─────────────────────────────────────────────────
            if (accent) ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);

            // Left
            const lx = view.offsetX + (left / 100) * iw * view.scale;
            ctx.beginPath();
            ctx.moveTo(lx, view.offsetY);
            ctx.lineTo(lx, view.offsetY + ih * view.scale);
            ctx.stroke();

            // Right
            const rx = view.offsetX + (1 - right / 100) * iw * view.scale;
            ctx.beginPath();
            ctx.moveTo(rx, view.offsetY);
            ctx.lineTo(rx, view.offsetY + ih * view.scale);
            ctx.stroke();

            // Top
            const ty = view.offsetY + (top / 100) * ih * view.scale;
            ctx.beginPath();
            ctx.moveTo(view.offsetX, ty);
            ctx.lineTo(view.offsetX + iw * view.scale, ty);
            ctx.stroke();

            // Bottom
            const by = view.offsetY + (1 - bottom / 100) * ih * view.scale;
            ctx.beginPath();
            ctx.moveTo(view.offsetX, by);
            ctx.lineTo(view.offsetX + iw * view.scale, by);
            ctx.stroke();

            ctx.setLineDash([]);
        }

        // ── Hit test ──────────────────────────────────────────────────────────

        /**
         * Return which handle is within HANDLE_HIT_PX of the given image-space point.
         * @param {number} ix - image-space x
         * @param {number} iy - image-space y
         * @returns {'left'|'right'|'top'|'bottom'|null}
         */
        function _hitTest(ix, iy) {
            const iw = _natural.w;
            const ih = _natural.h;
            // Tolerance in image px for a consistent grab target in screen px.
            const tol = HANDLE_HIT_PX / view.scale;

            const lx = (_val.left  / 100) * iw;
            const rx = (1 - _val.right  / 100) * iw;
            const ty = (_val.top   / 100) * ih;
            const by = (1 - _val.bottom / 100) * ih;

            // Vertical handles: test x distance, require point inside image height
            if (iy >= 0 && iy <= ih) {
                if (Math.abs(ix - lx) <= tol) return 'left';
                if (Math.abs(ix - rx) <= tol) return 'right';
            }
            // Horizontal handles: test y distance, require point inside image width
            if (ix >= 0 && ix <= iw) {
                if (Math.abs(iy - ty) <= tol) return 'top';
                if (Math.abs(iy - by) <= tol) return 'bottom';
            }
            return null;
        }

        // ── Report ────────────────────────────────────────────────────────────

        function _report() {
            props.onChange?.({ ..._val });
        }

        // ── Pointer events ────────────────────────────────────────────────────

        _unsubs.push(on(canvasEl, 'mousedown', (ev) => {
            if (!_loaded) return;
            const p = _toImage(ev);
            const hit = _hitTest(p.x, p.y);
            if (!hit) return;
            ev.preventDefault();
            _dragging = hit;
        }));

        _unsubs.push(on(window, 'mousemove', (ev) => {
            if (!_loaded) return;
            const p = _toImage(ev);
            if (!_dragging) {
                const hit = _hitTest(p.x, p.y);
                canvasEl.style.cursor = hit
                    ? (hit === 'left' || hit === 'right' ? 'ew-resize' : 'ns-resize')
                    : 'default';
                return;
            }
            const iw = _natural.w;
            const ih = _natural.h;
            switch (_dragging) {
                case 'left':
                    _val = { ..._val, left:   clampEdge((p.x / iw) * 100) };
                    break;
                case 'right':
                    _val = { ..._val, right:  clampEdge(((iw - p.x) / iw) * 100) };
                    break;
                case 'top':
                    _val = { ..._val, top:    clampEdge((p.y / ih) * 100) };
                    break;
                case 'bottom':
                    _val = { ..._val, bottom: clampEdge(((ih - p.y) / ih) * 100) };
                    break;
            }
            _draw();
        }));

        _unsubs.push(on(window, 'mouseup', () => {
            if (!_dragging) return;
            _dragging = null;
            _report();
        }));

        // ── Sizing + load ─────────────────────────────────────────────────────

        function _syncCanvasSize() {
            const w = Math.round(stageEl.clientWidth);
            const h = Math.round(stageEl.clientHeight);
            if (!w || !h) return;
            if (w === canvasEl.width && h === canvasEl.height) return;
            canvasEl.width  = w;
            canvasEl.height = h;
            _refit();
            _draw();
        }

        _unsubs.push(on(_imgEl, 'load', () => {
            _natural = originalSize(_imgEl);
            _loaded  = true;
            _syncCanvasSize();
            // The ResizeObserver usually sized the canvas BEFORE the load, so the sync above
            // returns early and never fits: without this the picture drew at scale 1 from its
            // top-left corner (Fabio, 2026-10-13). MpiStepCrop refits here the same way.
            _refit();
            _draw();
        }));

        const _ro = new ResizeObserver((entries) => {
            // Bail on 0×0 — hidden by MpiOverlay stash (MPI-597)
            const rect = entries[0]?.contentRect;
            if (!rect?.width || !rect?.height) return;
            _syncCanvasSize();
        });
        _ro.observe(stageEl);

        // Source last: with handler wired, a cached image still fires load.
        const _url = props.media?.url ? resolveMediaUrl(props.media.url) : '';
        if (_url) setDisplaySrc(_imgEl, _url);

        // ── Public interface ──────────────────────────────────────────────────

        el.getValue = () => ({ ..._val });

        el.destroy = () => {
            _ro.disconnect();
            _unsubs.forEach(fn => fn?.());
        };
    },
});
