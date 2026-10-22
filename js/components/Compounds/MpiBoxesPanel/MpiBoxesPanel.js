import { ComponentFactory } from '../../factory.js';
import { MpiButton, mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { qs, qsa, on } from '../../../utils/dom.js';
import { boxName, uniqueBoxName } from '../../../data/layoutBoxes.js';

/**
 * MpiBoxesPanel — draw where things go in the picture (Compound, MPI-1181)
 *
 * Slides up from behind the PromptBox when its Boxes button is pressed and back down on
 * the next press; no backdrop, so the prompt, the ratio and Run stay live while it is open.
 * LEFT: one row per box: its colour (= its border), its name (click puts `<name>` in the
 * prompt), what goes / happens there (optional), and a minus. RIGHT, top-aligned: the
 * output frame (a blank at the picked ratio on t2i, the picture on edit, centred in the
 * custom size when one is on). Drag on the frame to draw a box (inside another box too),
 * a box's tag to move it, its corner to resize it; double-click a tag to rename the box.
 * A new box opens its rename at once.
 *
 * Boxes are `{ x, y, w, h, desc, name }`, fractions of the frame. Every edit calls
 * `onChange` with a fresh copy; there is no OK button.
 *
 * Analyse (MPI-1253, t2i only) asks the PromptBox to read the guide picture into boxes: the
 * card picked with right-click > Create boxes (`frame.guide`, never on the run).
 *
 * Instance methods (on instance.el):
 *   open({ boxes, frame: {url?, w?, h?, guide?}, mode: 't2i'|'edit', accent, onChange(boxes),
 *          onCite(name), onRename(from, to), onClose(), onAnalyse() }) — fill and slide up
 *   setFrame(frame) — redraw the frame (ratio, custom size or picture changed)
 *   setBusy(bool) — Analyse running: its button waits
 *   hide() — slide down
 *   isOpen()
 */

// ponytail: six family/status tokens, cycled. A seventh box repeats a colour; its name
// still tells it apart.
const COLOURS = ['--accent-frost', '--prompt-accent', '--accent-ok', '--video-accent', '--vision-accent', '--accent-err'];
const MAX_BOXES = 10;
const MIN_SIZE = 0.03;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const MpiBoxesPanel = ComponentFactory.create({
    name: 'MpiBoxesPanel',
    css: ['js/components/Compounds/MpiBoxesPanel/MpiBoxesPanel.css'],

    template: () => `
        <div class="mpi-boxes" aria-label="Boxes">
            <div class="mpi-boxes__side">
                <div class="mpi-boxes__header">
                    <div class="mpi-boxes__kicker">Boxes</div>
                    <div class="mpi-boxes__actions">
                        <div id="boxes-analyse"></div>
                        <div id="boxes-clear"></div>
                        <div id="boxes-close"></div>
                    </div>
                </div>
                <div class="mpi-boxes__list" id="boxes-list"></div>
                <div class="mpi-boxes__dim" id="boxes-dim">
                    <div class="mpi-boxes__dim-lbl"><span>Darken</span><span id="boxes-dim-val">0%</span></div>
                    <div id="boxes-dim-bar"></div>
                </div>
                <p class="mpi-boxes__hint">Drag on the picture to draw a box, a tag to move it, a corner to resize it. Double-click a tag to rename. Click a name to cite it in the prompt.<span id="boxes-drop-hint"> To lay a picture out like another one, right-click that card and pick Create boxes.</span></p>
            </div>
            <div class="mpi-boxes__stage" id="boxes-stage">
                <div class="mpi-boxes__frame" id="boxes-frame"></div>
            </div>
        </div>
    `,

    setup: (el) => {
        const listEl = qs('#boxes-list', el);
        const stageEl = qs('#boxes-stage', el);
        const frameEl = qs('#boxes-frame', el);
        const dimEl = qs('#boxes-dim', el);
        const dimValEl = qs('#boxes-dim-val', el);
        const _unsubs = [];
        let _rowInputs = [];
        let boxes = [];
        let aspect = 1;
        let frameKey = '';
        let mode = 't2i';
        let dim = 0;
        let cb = {};

        const clearBtn = MpiButton.mount(qs('#boxes-clear', el), {
            icon: 'trash', label: 'Clear all', labelPosition: 'right', size: 'sm', variant: 'ghost', info: 'Remove every box',
        });
        clearBtn.on('click', () => { boxes = []; _changed(true); });
        const closeBtn = MpiButton.mount(qs('#boxes-close', el), { icon: 'close', variant: 'ghost', size: 'sm', info: 'Close Boxes (they stay on the run)' });
        closeBtn.on('click', () => { el.hide(); cb.onClose?.(); });
        // MPI-1253: the describer reads the guide picture into boxes again (the PromptBox runs it).
        const analyseBtn = MpiButton.mount(qs('#boxes-analyse', el), {
            icon: 'eye', label: 'Analyse', labelPosition: 'right', size: 'sm', variant: 'ghost',
            info: 'Read the picture into boxes, each with what is in it (replaces the boxes)',
        });
        analyseBtn.on('click', () => cb.onAnalyse?.());
        let busy = false;
        const _syncAnalyse = () => analyseBtn.el.setDisabled?.(busy || !qs('.mpi-boxes__picture', frameEl));

        const _setDim = (v) => {
            dim = clamp(Number(v) || 0, 0, 100);
            dimValEl.textContent = `${Math.round(dim)}%`;
            const img = qs('.mpi-boxes__picture', frameEl);
            if (img) img.style.filter = dim ? `brightness(${1 - dim / 100})` : '';
        };
        const dimBar = MpiProgressBar.mount(qs('#boxes-dim-bar', el), {
            min: 0, max: 100, step: 1, value: 0, interactive: true, wheel: true, handle: true, variant: 'primary',
            info: 'Darken the picture so the boxes stand out (the run is untouched)',
        });
        dimBar.on('input', ({ value }) => _setDim(value));
        dimBar.on('change', ({ value }) => _setDim(value));

        const _emit = () => cb.onChange?.(boxes.map((b) => ({ ...b })));

        // ── the frame: the picked aspect, as tall as the panel allows, top-aligned ──
        const _fit = () => {
            const r = stageEl.getBoundingClientRect();
            if (!r.width) return; // hidden is not resized (components.md, MPI-597)
            const maxH = Math.min(window.innerHeight * 0.42, 460);
            const w = Math.min(r.width, maxH * aspect);
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
        const _drag = (e, i, how, onDone) => {
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
                if (how === 'move') {
                    b.x = clamp(start.x + cx - sx, 0, 1 - b.w);
                    b.y = clamp(start.y + cy - sy, 0, 1 - b.h);
                } else if (how === 'resize') {
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
            const offUp = on(window, 'pointerup', () => { offMove(); offUp(); _emit(); onDone?.(); }, { once: true });
        };

        _unsubs.push(on(frameEl, 'pointerdown', (e) => {
            if (e.button !== 0 || e.target !== frameEl && !e.target.classList.contains('mpi-boxes__picture')) return;
            if (boxes.length >= MAX_BOXES) return;
            const r = frameEl.getBoundingClientRect();
            const x = clamp((e.clientX - r.left) / r.width, 0, 1);
            const y = clamp((e.clientY - r.top) / r.height, 0, 1);
            boxes.push({ x, y, w: MIN_SIZE, h: MIN_SIZE, desc: '', name: uniqueBoxName('box', boxes) });
            _changed(true);
            const i = boxes.length - 1;
            _drag(e, i, 'draw', () => _rename(i));
        }));

        // ── rename: the row's name becomes a field; Enter or leaving it keeps it ──
        const _rename = (i) => {
            const row = listEl.children[i];
            const nameBtn = row && qs('.mpi-boxes__name', row);
            if (!nameBtn) return;
            const host = document.createElement('div');
            host.className = 'mpi-boxes__name-edit';
            nameBtn.replaceWith(host);
            const inp = MpiInput.mount(host, { type: 'text', size: 'sm', value: boxes[i].name || '', info: 'Name this box: letters, numbers and _' });
            _rowInputs.push(inp);
            inp.on('change', ({ value }) => {
                if (!boxes[i]) return;
                const from = boxes[i].name;
                const to = uniqueBoxName(boxName(value) || from, boxes.filter((_, j) => j !== i));
                boxes[i].name = to;
                _changed(true);
                if (from && to !== from) cb.onRename?.(from, to);
            });
            const field = qs('input', host);
            field?.focus();
            field?.select();
        };

        // ── render ───────────────────────────────────────────────────────────
        const _renderFrame = () => {
            qsa('.mpi-boxes__box', frameEl).forEach((n) => n.remove());
            boxes.forEach((b, i) => {
                const node = document.createElement('div');
                node.className = 'mpi-boxes__box';
                node.style.setProperty('--box-colour', `var(${COLOURS[i % COLOURS.length]})`);
                node.innerHTML = '<span class="mpi-boxes__tag"></span><span class="mpi-boxes__handle"></span>';
                const tag = qs('.mpi-boxes__tag', node);
                tag.textContent = b.name;
                _place(node, b);
                on(node, 'pointerdown', (e) => {
                    if (e.button !== 0) return;
                    _drag(e, i, e.target.classList.contains('mpi-boxes__handle') ? 'resize' : 'move');
                });
                on(tag, 'dblclick', () => _rename(i));
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

                const name = mountButton({ variant: 'ghost', size: 'sm', text: b.name, info: `Put <${b.name}> in the prompt`, extraClasses: 'mpi-boxes__name' });
                on(name, 'click', () => cb.onCite?.(boxes[i].name));
                row.appendChild(name);

                const field = document.createElement('div');
                field.className = 'mpi-boxes__field';
                const inp = MpiInput.mount(field, {
                    type: 'text', value: b.desc || '',
                    placeholder: mode === 'edit' ? 'What happens here' : 'What goes here',
                    info: 'Optional: what this box holds. Empty = its name; the prompt can say the rest',
                });
                inp.on('input', ({ value }) => { boxes[i].desc = value; _emit(); });
                _rowInputs.push(inp);
                row.appendChild(field);

                const minus = mountButton({ icon: 'minus', variant: 'ghost', size: 'sm', info: `Remove ${b.name}` });
                on(minus, 'click', () => { boxes.splice(i, 1); _changed(true); });
                row.appendChild(minus);

                listEl.appendChild(row);
            });
            clearBtn.el.setDisabled?.(!boxes.length);
        };

        const _changed = (emitNow) => {
            _renderFrame();
            _renderList();
            if (emitNow) _emit();
        };

        el.setFrame = (frame = {}) => {
            const key = JSON.stringify([frame.url || '', frame.w || 0, frame.h || 0]);
            if (key === frameKey) return;
            frameKey = key;
            qs('.mpi-boxes__picture', frameEl)?.remove();
            // A given size wins (the custom size on edit: the picture sits centred in it);
            // else the picture's own shape; else square.
            aspect = frame.w && frame.h ? frame.w / frame.h : 1;
            dimEl.classList.toggle('hide', !frame.url);
            if (frame.url) {
                const img = document.createElement('img');
                // A t2i guide is stretched to the frame: its boxes are fractions of the
                // picture, and the ratio Analyse picks is only the nearest one.
                img.className = `mpi-boxes__picture${frame.guide ? ' mpi-boxes__picture--guide' : ''}`;
                img.alt = '';
                img.draggable = false;
                if (!(frame.w && frame.h)) img.onload = () => { aspect = img.naturalWidth / img.naturalHeight || 1; _fit(); };
                img.src = frame.url;
                frameEl.appendChild(img);
                _setDim(dim);
            }
            _syncAnalyse();
            _fit();
        };

        el.open = ({ boxes: initial = [], frame = {}, mode: m = 't2i', accent, onChange, onCite, onRename, onClose, onAnalyse } = {}) => {
            el.dataset.accent = accent || 'studio';
            cb = { onChange, onCite, onRename, onClose, onAnalyse };
            mode = m;
            qs('#boxes-drop-hint', el).classList.toggle('hide', mode === 'edit');
            qs('#boxes-analyse', el).classList.toggle('hide', mode === 'edit');
            boxes = initial.map((b, i) => ({ ...b, name: b.name || `obj_${i + 1}` }));
            frameKey = '';
            el.setFrame(frame);
            _changed(false);
            el.classList.add('mpi-boxes--open');
            requestAnimationFrame(_fit);
        };

        /** Analyse is running (its queue row shows the progress): the button waits. */
        el.setBusy = (on_) => { busy = !!on_; _syncAnalyse(); };

        el.hide = () => el.classList.remove('mpi-boxes--open');
        el.isOpen = () => el.classList.contains('mpi-boxes--open');

        el.destroy = () => {
            _unsubs.forEach((fn) => fn());
            ro.disconnect();
            _rowInputs.forEach((inp) => inp.destroy?.());
            clearBtn.destroy?.();
            closeBtn.destroy?.();
            analyseBtn.destroy?.();
            dimBar.destroy?.();
            el.remove();
        };
    },
});
