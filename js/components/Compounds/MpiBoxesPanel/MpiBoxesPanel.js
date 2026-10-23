import { ComponentFactory } from '../../factory.js';
import { MpiButton, mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiResizeHandle } from '../../Primitives/MpiResizeHandle/MpiResizeHandle.js';
import { qs, qsa, on } from '../../../utils/dom.js';
import { boxName, uniqueBoxName, MAX_BOXES } from '../../../data/layoutBoxes.js';
import { Storage } from '../../../core/storage.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';

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
 * Create boxes (MPI-1253, t2i only, a gallery card's right-click) draws the card it read
 * under the boxes (`frame.guide`, never on the run); Remove picture takes it away.
 * A row's eye hides its box on the frame only: the run still gets every box.
 *
 * Instance methods (on instance.el):
 *   open({ boxes, frame: {url?, w?, h?, guide?}, mode: 't2i'|'edit', accent, onChange(boxes),
 *          onCite(name), onRename(from, to), onClose(), onRemovePicture() }) — fill and slide up
 *   setFrame(frame) — redraw the frame (ratio, custom size or picture changed)
 *   hide() — slide down
 *   isOpen()
 */

// ponytail: six family/status tokens, cycled. A seventh box repeats a colour; its name
// still tells it apart.
const COLOURS = ['--accent-frost', '--prompt-accent', '--accent-ok', '--video-accent', '--vision-accent', '--accent-err'];
const MIN_SIZE = 0.03;
const TAG_IN_Y = 0.04;    // a box this close to the frame top keeps its tag inside (the panel's padding takes any spill)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TOP_GAP = 200;      // px the open panel leaves below the window top (header + op strip room)
const MIN_PANEL_H = 260;  // a short window still shows a usable frame
const MIN_SIDE_W = 280;   // name + a few words of the desc
const MIN_STAGE_W = 200;

export const MpiBoxesPanel = ComponentFactory.create({
    name: 'MpiBoxesPanel',
    css: ['js/components/Compounds/MpiBoxesPanel/MpiBoxesPanel.css'],

    template: () => `
        <div class="mpi-boxes" aria-label="Boxes">
            <div class="mpi-boxes__side">
                <div class="mpi-boxes__header">
                    <div class="mpi-boxes__kicker">Boxes</div>
                    <div class="mpi-boxes__actions">
                        <div id="boxes-unguide"></div>
                        <div id="boxes-clear"></div>
                    </div>
                </div>
                <div class="mpi-boxes__list" id="boxes-list"></div>
                <div class="mpi-boxes__dim" id="boxes-dim">
                    <div class="mpi-boxes__dim-lbl"><span>Darken</span><span id="boxes-dim-val">0%</span></div>
                    <div id="boxes-dim-bar"></div>
                </div>
                <p class="mpi-boxes__hint">Drag on the picture to draw a box, a tag to move it, a corner to resize it. Double-click a tag to rename. Click a name to cite it in the prompt.<span id="boxes-drop-hint"> To lay a picture out like another one, right-click that card and pick Create boxes.</span></p>
            </div>
            <div class="mpi-boxes__sash" id="boxes-sash"></div>
            <div class="mpi-boxes__stage" id="boxes-stage">
                <div class="mpi-boxes__frame" id="boxes-frame"></div>
            </div>
            <div class="mpi-boxes__close" id="boxes-close"></div>
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
        const _hidden = new Set(); // names whose box the eye hid on the frame (view only)
        let aspect = 1;
        let frameKey = '';
        let mode = 't2i';
        let dim = Storage.getBoxesDim();
        let cb = {};
        let _sel = -1; // the box picked on the frame or in the list: its tag and its row light up

        /** Link a box to its row (Fabio, 2026-10-23): pressing a tag lights the row's field,
         *  pressing a row lights the tag. Re-applied after every render. */
        const _select = (i) => {
            _sel = i;
            [...frameEl.children].forEach((n, j) => n.classList.toggle('mpi-boxes__box--selected', j === i));
            [...listEl.children].forEach((n, j) => n.classList.toggle('mpi-boxes__row--selected', j === i));
        };

        const clearBtn = MpiButton.mount(qs('#boxes-clear', el), {
            icon: 'trash', label: 'Clear all', labelPosition: 'right', size: 'sm', variant: 'ghost', info: 'Remove every box',
        });
        clearBtn.on('click', () => { boxes = []; _changed(true); });
        const closeBtn = MpiButton.mount(qs('#boxes-close', el), { icon: 'close', variant: 'ghost', size: 'sm', info: 'Close Boxes (they stay on the run)' });
        // The panel's top-right corner and Escape both close it: a first-timer does not know
        // the PromptBox button toggles it (Fabio, 2026-10-23).
        const _close = () => { el.hide(); cb.onClose?.(); };
        closeBtn.on('click', _close);
        let _escOff = null;
        const _onEscape = (e) => {
            const ctx = e?.mpiEscapeContext || {};
            // A menu, popup or overlay this press closed or is closing goes first; a field
            // being typed in only loses focus.
            if (e?.mpiEscapeOverlayClosed || ctx.activeDismissableUi || ctx.textEntryFocused || ctx.promptBoxFocused) return;
            _close();
        };
        // The layout picture waits on t2i while another op runs; this drops it for good.
        const unguideBtn = MpiButton.mount(qs('#boxes-unguide', el), {
            icon: 'eraser', label: 'Remove picture', labelPosition: 'right', size: 'sm', variant: 'ghost',
            info: 'Take the picture away for good (the boxes stay)',
        });
        unguideBtn.on('click', () => cb.onRemovePicture?.());

        const _setDim = (v) => {
            dim = clamp(Number(v) || 0, 0, 100);
            dimValEl.textContent = `${Math.round(dim)}%`;
            const img = qs('.mpi-boxes__picture', frameEl);
            if (img) img.style.filter = dim ? `brightness(${1 - dim / 100})` : '';
        };
        const dimBar = MpiProgressBar.mount(qs('#boxes-dim-bar', el), {
            min: 0, max: 100, step: 1, value: dim, interactive: true, wheel: true, handle: true, variant: 'primary',
            info: 'Darken the picture so the boxes stand out (the run is untouched)',
        });
        dimBar.on('input', ({ value }) => _setDim(value));
        dimBar.on('change', ({ value }) => { _setDim(value); Storage.setBoxesDim(dim); });
        _setDim(dim);

        const _emit = () => cb.onChange?.(boxes.map((b) => ({ ...b })));

        // ── the panel: from the bar up to TOP_GAP below the window top (Fabio, 2026-10-23),
        //    the rows scroll; the frame: the picked aspect, as big as the stage allows ──
        const _fit = () => {
            const bottom = el.parentElement?.getBoundingClientRect().bottom || 0;
            el.style.height = `${Math.max(MIN_PANEL_H, bottom - TOP_GAP)}px`;
            const r = stageEl.getBoundingClientRect();
            if (!r.width) return; // hidden is not resized (components.md, MPI-597)
            const w = Math.min(r.width, r.height * aspect);
            frameEl.style.width = `${w}px`;
            frameEl.style.height = `${w / aspect}px`;
        };
        const ro = new ResizeObserver(_fit);
        ro.observe(stageEl);
        _unsubs.push(on(window, 'resize', _fit));

        // The sash between the list and the picture: drag it for longer rows or a bigger
        // picture; the stage's ResizeObserver refits the frame as it moves.
        // ponytail: width lives for the panel's life, persist it in Storage if asked.
        const sash = MpiResizeHandle.mount(qs('#boxes-sash', el), { axis: 'x' });
        sash.on('resize', ({ x }) => {
            const r = el.getBoundingClientRect();
            const left = qs('.mpi-boxes__side', el).getBoundingClientRect().left;
            const w = clamp(x - left, MIN_SIDE_W, r.width - (left - r.left) * 2 - MIN_STAGE_W);
            el.style.setProperty('--boxes-side-w', `${w}px`);
        });

        const _place = (node, b) => {
            node.style.left = `${b.x * 100}%`;
            node.style.top = `${b.y * 100}%`;
            node.style.width = `${b.w * 100}%`;
            node.style.height = `${b.h * 100}%`;
            // The tag rides above the box so it never hides the box's first line; a box at
            // the frame top has no room above, so its tag drops back inside (Fabio, 2026-10-23).
            node.classList.toggle('mpi-boxes__box--tag-in', b.y < TAG_IN_Y);
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
                if (_hidden.delete(from)) _hidden.add(to);
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
                node.className = `mpi-boxes__box${_hidden.has(b.name) ? ' hide' : ''}`;
                node.style.setProperty('--box-colour', `var(${COLOURS[i % COLOURS.length]})`);
                node.innerHTML = '<span class="mpi-boxes__tag"></span><span class="mpi-boxes__handle"></span>';
                const tag = qs('.mpi-boxes__tag', node);
                tag.textContent = b.name;
                _place(node, b);
                on(node, 'pointerdown', (e) => {
                    if (e.button !== 0) return;
                    _select(i);
                    listEl.children[i]?.scrollIntoView({ block: 'nearest' });
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
                on(row, 'pointerdown', () => _select(i));
                on(row, 'focusin', () => _select(i));

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

                const shown = !_hidden.has(b.name);
                const eye = mountButton({ icon: 'eye', variant: 'ghost', size: 'sm',
                    info: shown ? `Hide ${b.name} on the picture (it still runs)` : `Show ${b.name} on the picture` });
                eye.setActive?.(shown);
                on(eye, 'click', () => {
                    if (shown) _hidden.add(boxes[i].name); else _hidden.delete(boxes[i].name);
                    _changed(false);
                });
                row.appendChild(eye);

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
            _select(_sel < boxes.length ? _sel : -1);
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
            qs('#boxes-unguide', el).classList.toggle('hide', !frame.guide);
            if (frame.url) {
                const img = document.createElement('img');
                // A t2i guide is stretched to the frame: its boxes are fractions of the
                // picture, and the ratio Create boxes picks is only the nearest one.
                img.className = `mpi-boxes__picture${frame.guide ? ' mpi-boxes__picture--guide' : ''}`;
                img.alt = '';
                img.draggable = false;
                if (!(frame.w && frame.h)) img.onload = () => { aspect = img.naturalWidth / img.naturalHeight || 1; _fit(); };
                img.src = frame.url;
                frameEl.appendChild(img);
                _setDim(dim);
            }
            _fit();
        };

        el.open = ({ boxes: initial = [], frame = {}, mode: m = 't2i', accent, onChange, onCite, onRename, onClose, onRemovePicture } = {}) => {
            el.dataset.accent = accent || 'studio';
            cb = { onChange, onCite, onRename, onClose, onRemovePicture };
            mode = m;
            qs('#boxes-drop-hint', el).classList.toggle('hide', mode === 'edit');
            boxes = initial.map((b, i) => ({ ...b, name: b.name || `obj_${i + 1}` }));
            _sel = -1;
            frameKey = '';
            el.setFrame(frame);
            _changed(false);
            el.classList.add('mpi-boxes--open');
            _escOff ??= Hotkeys.bind('boxes.close', _onEscape);
            requestAnimationFrame(_fit);
        };

        /** The owner's edge moved (the bar grew with a long prompt): fit the band again. */
        el.fit = _fit;
        el.hide = () => {
            el.classList.remove('mpi-boxes--open');
            _escOff?.();
            _escOff = null;
        };
        el.isOpen = () => el.classList.contains('mpi-boxes--open');

        el.destroy = () => {
            _escOff?.();
            _unsubs.forEach((fn) => fn());
            ro.disconnect();
            _rowInputs.forEach((inp) => inp.destroy?.());
            clearBtn.destroy?.();
            closeBtn.destroy?.();
            unguideBtn.destroy?.();
            dimBar.destroy?.();
            sash.destroy?.();
            el.remove();
        };
    },
});
