import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiButton, mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { qs, qsa, on } from '../../../utils/dom.js';

/**
 * MpiBoxesDialog — draw where things go in the picture (Compound, MPI-1181)
 *
 * Opened by the PromptBox's Boxes button. RIGHT: the output frame (a blank at the picked
 * ratio on t2i, the first picture on edit); drag on it to draw a box (inside another box
 * too), drag a box's tag to move it, its corner to resize it. LEFT: one row per box: its colour (= its border), its
 * name (click puts `<obj_N>` in the prompt), what goes there, and a minus. Box N is always
 * `obj_N`, so removing a box renumbers the ones after it.
 *
 * Boxes are `{ x, y, w, h, desc }`, fractions of the frame. Every edit calls `onChange`
 * with a fresh copy; there is no OK button, closing keeps what is drawn.
 *
 * MpiModal owns the backdrop, the portal, the Overlays entry and Escape.
 *
 * Instance methods (on instance.el):
 *   open({ boxes, frame: {url}|{w,h}, accent, onChange(boxes), onCite(n) }) — fill and show
 *   hide()
 */

// ponytail: six family/status tokens, cycled. A seventh box repeats a colour; its name
// still tells it apart.
const COLOURS = ['--accent-frost', '--prompt-accent', '--accent-ok', '--video-accent', '--vision-accent', '--accent-err'];
const MAX_BOXES = 10;
const MIN_SIZE = 0.03;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const MpiBoxesDialog = ComponentFactory.create({
    name: 'MpiBoxesDialog',
    css: ['js/components/Compounds/MpiBoxesDialog/MpiBoxesDialog.css'],

    template: () => `
        <div class="mpi-boxes" role="dialog" aria-modal="true" aria-labelledby="boxes-title">
            <div class="mpi-boxes__header">
                <div class="mpi-boxes__heading">
                    <div class="mpi-boxes__kicker">Boxes</div>
                    <div class="mpi-boxes__title" id="boxes-title">Place things in the picture</div>
                </div>
                <div class="mpi-boxes__close" id="boxes-close"></div>
            </div>
            <div class="mpi-boxes__body">
                <div class="mpi-boxes__side">
                    <div class="mpi-boxes__list" id="boxes-list"></div>
                    <div id="boxes-add"></div>
                    <p class="mpi-boxes__hint">Drag on the picture to draw a box, a box's tag to move it, its corner to resize it. Click a name to cite it in the prompt. Background first, foreground last.</p>
                </div>
                <div class="mpi-boxes__stage" id="boxes-stage">
                    <div class="mpi-boxes__frame" id="boxes-frame"></div>
                </div>
            </div>
        </div>
    `,

    setup: (el) => {
        const modal = MpiModal.mount(document.createElement('div'), {
            width: 'min(1100px, 94vw)',
            backdropClose: true,
        });
        modal.el.appendChild(el);
        el.hide = () => modal.el.hide();

        const listEl = qs('#boxes-list', el);
        const stageEl = qs('#boxes-stage', el);
        const frameEl = qs('#boxes-frame', el);
        const _unsubs = [];
        let _rowInputs = [];
        let boxes = [];
        let aspect = 1;
        let cb = {};

        const closeBtn = MpiButton.mount(qs('#boxes-close', el), { icon: 'close', variant: 'ghost', size: 'sm', info: 'Close' });
        closeBtn.on('click', () => el.hide());
        const addBtn = MpiButton.mount(qs('#boxes-add', el), {
            icon: 'plus', label: 'Add box', labelPosition: 'right', size: 'sm', variant: 'secondary',
            info: 'Add a box in the middle of the picture',
        });
        addBtn.on('click', () => {
            if (boxes.length >= MAX_BOXES) return;
            boxes.push({ x: 0.35, y: 0.35, w: 0.3, h: 0.3, desc: '' });
            _changed(true);
        });

        const _emit = () => cb.onChange?.(boxes.map((b) => ({ ...b })));

        // ── the frame: fit the picked aspect inside the stage ─────────────────
        const _fit = () => {
            const r = stageEl.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const w = Math.min(r.width, r.height * aspect);
            frameEl.style.width = `${w}px`;
            frameEl.style.height = `${w / aspect}px`;
        };
        const ro = new ResizeObserver(_fit);
        ro.observe(stageEl);

        const _place = (node, b) => {
            node.style.left = `${b.x * 100}%`;
            node.style.top = `${b.y * 100}%`;
            node.style.width = `${b.w * 100}%`;
            node.style.height = `${b.h * 100}%`;
        };

        // ── drag: move, resize from the corner, or draw on empty frame ────────
        const _drag = (e, i, mode) => {
            e.preventDefault();
            e.stopPropagation();
            const r = frameEl.getBoundingClientRect();
            const px = (ev) => [clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)];
            const [sx, sy] = px(e);
            const start = { ...boxes[i] };
            const node = frameEl.children[i];
            const move = (ev) => {
                const [cx, cy] = px(ev);
                const b = boxes[i];
                if (mode === 'move') {
                    b.x = clamp(start.x + cx - sx, 0, 1 - b.w);
                    b.y = clamp(start.y + cy - sy, 0, 1 - b.h);
                } else if (mode === 'resize') {
                    b.w = clamp(start.w + cx - sx, MIN_SIZE, 1 - b.x);
                    b.h = clamp(start.h + cy - sy, MIN_SIZE, 1 - b.y);
                } else {
                    b.x = Math.min(sx, cx); b.y = Math.min(sy, cy);
                    b.w = Math.max(MIN_SIZE, Math.abs(cx - sx)); b.h = Math.max(MIN_SIZE, Math.abs(cy - sy));
                    b.w = Math.min(b.w, 1 - b.x); b.h = Math.min(b.h, 1 - b.y);
                }
                _place(node, b);
            };
            const offMove = on(window, 'pointermove', move);
            const offUp = on(window, 'pointerup', () => { offMove(); offUp(); _emit(); }, { once: true });
        };

        _unsubs.push(on(frameEl, 'pointerdown', (e) => {
            if (e.button !== 0 || e.target !== frameEl && !e.target.classList.contains('mpi-boxes__picture')) return;
            if (boxes.length >= MAX_BOXES) return;
            const r = frameEl.getBoundingClientRect();
            const x = clamp((e.clientX - r.left) / r.width, 0, 1);
            const y = clamp((e.clientY - r.top) / r.height, 0, 1);
            boxes.push({ x, y, w: MIN_SIZE, h: MIN_SIZE, desc: '' });
            _changed(true);
            _drag(e, boxes.length - 1, 'draw');
        }));

        // ── render ───────────────────────────────────────────────────────────
        const _renderFrame = () => {
            qsa('.mpi-boxes__box', frameEl).forEach((n) => n.remove());
            boxes.forEach((b, i) => {
                const node = document.createElement('div');
                node.className = 'mpi-boxes__box';
                node.style.setProperty('--box-colour', `var(${COLOURS[i % COLOURS.length]})`);
                node.innerHTML = `<span class="mpi-boxes__tag">obj_${i + 1}</span><span class="mpi-boxes__handle"></span>`;
                _place(node, b);
                on(node, 'pointerdown', (e) => {
                    if (e.button !== 0) return;
                    _drag(e, i, e.target.classList.contains('mpi-boxes__handle') ? 'resize' : 'move');
                });
                frameEl.insertBefore(node, qs('.mpi-boxes__picture', frameEl));
            });
            // Boxes are children 0..n-1 (the drag reads frameEl.children[i]); the picture,
            // when there is one, stays last and under them in paint order via z-index.
        };

        const _renderList = () => {
            _rowInputs.forEach((inp) => inp.destroy?.());
            _rowInputs = [];
            listEl.replaceChildren();
            boxes.forEach((b, i) => {
                const row = document.createElement('div');
                row.className = 'mpi-boxes__row';
                row.style.setProperty('--box-colour', `var(${COLOURS[i % COLOURS.length]})`);

                const swatch = document.createElement('span');
                swatch.className = 'mpi-boxes__swatch';
                row.appendChild(swatch);

                const name = mountButton({ variant: 'ghost', size: 'sm', text: `obj_${i + 1}`, info: `Put <obj_${i + 1}> in the prompt`, extraClasses: 'mpi-boxes__name' });
                on(name, 'click', () => cb.onCite?.(i + 1));
                row.appendChild(name);

                const field = document.createElement('div');
                field.className = 'mpi-boxes__field';
                const inp = MpiInput.mount(field, { type: 'text', value: b.desc || '', placeholder: 'What goes here', info: 'What this box holds: colours, material, pose' });
                inp.on('input', ({ value }) => { boxes[i].desc = value; _emit(); });
                _rowInputs.push(inp);
                row.appendChild(field);

                const minus = mountButton({ icon: 'minus', variant: 'ghost', size: 'sm', info: `Remove obj_${i + 1}; the boxes after it renumber` });
                on(minus, 'click', () => { boxes.splice(i, 1); _changed(true); });
                row.appendChild(minus);

                listEl.appendChild(row);
            });
            addBtn.el.setDisabled?.(boxes.length >= MAX_BOXES);
        };

        const _changed = (emitNow) => {
            _renderFrame();
            _renderList();
            if (emitNow) _emit();
        };

        el.open = ({ boxes: initial = [], frame = {}, accent, onChange, onCite } = {}) => {
            // MpiModal portals to document.body, so the accent must sit on the dialog itself.
            el.dataset.accent = accent || 'studio';
            cb = { onChange, onCite };
            boxes = initial.map((b) => ({ ...b }));
            qs('.mpi-boxes__picture', frameEl)?.remove();
            if (frame.url) {
                const img = document.createElement('img');
                img.className = 'mpi-boxes__picture';
                img.alt = '';
                img.draggable = false;
                img.onload = () => { aspect = img.naturalWidth / img.naturalHeight || 1; _fit(); };
                img.src = frame.url;
                frameEl.appendChild(img);
            } else {
                aspect = (frame.w || 1) / (frame.h || 1);
            }
            _changed(false);
            modal.el.show();
            requestAnimationFrame(_fit);
        };

        el.destroy = () => {
            _unsubs.forEach((fn) => fn());
            ro.disconnect();
            _rowInputs.forEach((inp) => inp.destroy?.());
            closeBtn.destroy?.();
            addBtn.destroy?.();
            modal.el.hide?.();
            modal.el.destroy?.();
        };
    },
});
