import { ComponentFactory } from '../../factory.js';
import { qs, qsa, on } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { buildTree, sortedFolderNames, sortedFiles } from '../../../utils/pathTree.js';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * MpiFileTree — an inline, multi-select folder tree (MPI-1057).
 *
 * MpiTreePicker's tree laid flat in the page instead of a portalled pick-one box:
 * a click on a file row toggles it in the selection, a click on a folder opens or
 * closes it. Each row can carry a right-aligned note (a size, "on the Pod", 42%).
 * The tree itself comes from `utils/pathTree.js`, shared with MpiTreePicker.
 *
 * State-dumb: the owner passes the rows and reads the selection back.
 *
 * Usage:
 *   const tree = MpiFileTree.mount(slot, { fileIcon: 'cube', emptyText: 'No LoRAs here.' });
 *   tree.el.setItems([{ value: 'CHROMA/x.safetensors', note: '1.2GB', disabled?: bool, dim?: bool }]);
 *   tree.el.setNote(value, '42%');      // patch one row's note in place
 *   tree.el.getSelected();              // -> string[] of values
 *   tree.el.clearSelection();
 *   tree.el.setMessage('text' | '');    // replaces the tree with a line of text (loading, an error)
 *   tree.on('select', ({ values }) => ...);
 *
 * Props:
 * @param {string} [fileIcon='image'] - icons.js key for file rows
 * @param {string} [emptyText='Nothing here.'] - shown when there are no rows
 *
 * Emits:
 * 'select' { values: string[] } — the selection changed
 */
export const MpiFileTree = ComponentFactory.create({
    name: 'MpiFileTree',
    css: ['js/components/Primitives/MpiFileTree/MpiFileTree.css'],

    template: () => `<div class="mpi-file-tree" role="listbox" aria-multiselectable="true"></div>`,

    setup: (el, props, emit) => {
        const fileIcon  = props.fileIcon ?? 'image';
        const emptyText = props.emptyText ?? 'Nothing here.';
        const _unsubs = [];

        let _items = [];
        let _message = '';
        const _selected = new Set();
        const _expanded = new Set();

        const fileRowHtml = (f, depth) => {
            const cls = [
                'mpi-file-tree__row', 'mpi-file-tree__row--file',
                _selected.has(f.value) ? 'is-selected' : '',
                f.disabled ? 'is-disabled' : '',
                f.dim ? 'mpi-file-tree__row--dim' : '',
            ].join(' ');
            return `
                <div class="${cls}" style="--depth:${depth}" data-value="${escapeHtml(f.value)}"
                     ${f.title ? `title="${escapeHtml(f.title)}"` : ''}>
                    <span class="mpi-file-tree__icon">${renderIcon(fileIcon, 'sm')}</span>
                    <span class="mpi-file-tree__label">${escapeHtml(f.label)}</span>
                    <span class="mpi-file-tree__note">${escapeHtml(f.note || '')}</span>
                </div>`;
        };

        const renderNode = (node, depth, prefix) => {
            let html = '';
            for (const name of sortedFolderNames(node)) {
                const path = prefix ? `${prefix}/${name}` : name;
                const open = _expanded.has(path);
                html += `
                    <div class="mpi-file-tree__row mpi-file-tree__row--folder" style="--depth:${depth}"
                         data-folder="${escapeHtml(path)}">
                        <span class="mpi-file-tree__chevron">${renderIcon(open ? 'chevronDown' : 'chevronRight', 'sm')}</span>
                        <span class="mpi-file-tree__icon">${renderIcon('folder', 'sm')}</span>
                        <span class="mpi-file-tree__label">${escapeHtml(name)}</span>
                    </div>`;
                if (open) html += renderNode(node.folders.get(name), depth + 1, path);
            }
            for (const f of sortedFiles(node)) html += fileRowHtml(f, depth);
            return html;
        };

        const render = () => {
            if (_message || !_items.length) {
                el.innerHTML = `<div class="mpi-file-tree__empty">${escapeHtml(_message || emptyText)}</div>`;
                return;
            }
            el.innerHTML = renderNode(buildTree(_items), 0, '');
        };

        const _emitSelect = () => emit('select', { values: [..._selected] });

        el.setItems = (items = []) => {
            _items = items;
            _message = '';
            // A row that left, or turned unselectable, leaves the selection too.
            const live = new Set(items.filter(i => !i.disabled).map(i => i.value));
            const before = _selected.size;
            for (const v of [..._selected]) if (!live.has(v)) _selected.delete(v);
            render();
            if (_selected.size !== before) _emitSelect();
        };

        el.setNote = (value, note) => {
            const row = qsa('.mpi-file-tree__row--file', el).find(r => r.dataset.value === value);
            const noteEl = row && qs('.mpi-file-tree__note', row);
            if (noteEl) noteEl.textContent = note;
        };

        el.setMessage = (text = '') => {
            _message = text;
            render();
        };

        el.getSelected = () => [..._selected];

        el.clearSelection = () => {
            if (!_selected.size) return;
            _selected.clear();
            render();
            _emitSelect();
        };

        _unsubs.push(on(el, 'click', (e) => {
            const folder = e.target.closest('.mpi-file-tree__row--folder');
            if (folder) {
                const path = folder.dataset.folder;
                _expanded.has(path) ? _expanded.delete(path) : _expanded.add(path);
                render();
                return;
            }
            const row = e.target.closest('.mpi-file-tree__row--file');
            if (!row || row.classList.contains('is-disabled')) return;
            const v = row.dataset.value;
            _selected.has(v) ? _selected.delete(v) : _selected.add(v);
            row.classList.toggle('is-selected', _selected.has(v));
            _emitSelect();
        }));

        el.destroy = () => _unsubs.forEach(fn => fn?.());

        render();
    },
});
