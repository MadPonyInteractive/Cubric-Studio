import { ComponentFactory } from '../../factory.js';
import { qs, qsa, on } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * MpiFilterBar — Tag-group + search header row (MPI-754)
 *
 * A Primitive, not a Compound: the shared header row for the Model Library and
 * the Flow Library, which are both Compounds and so may not import each other
 * (tier rule). Draws its OWN `<button>` tags and its OWN `<input>` search field
 * — the sanctioned exception to "never a bare form control", same as
 * MpiRadioGroup / MpiTreePicker. Never import MpiButton/MpiInput here: a
 * Primitive owns its own control chrome outright, it never restates another
 * Primitive's from outside.
 *
 * Props:
 * @param {Array<{key:string,label:string,options:Array<{value:string,label:string}>}>} [groups=[]]
 * @param {string} [searchPlaceholder='Search…']
 *
 * Emits:
 *   'change' { key, active: { [groupKey]: Set }, query }
 *   `key` is the group key that just toggled, or the literal string 'search'
 *   when the query changed. `active` is a fresh COPY of every group's Set
 *   (never the internal Set — callers cannot mutate state through it).
 *   `query` is trimmed and lowercased.
 *
 * Instance methods (on instance.el):
 *   setActive(key, values) — replace one group's active set (Array or Set of
 *                            values); updates aria-selected. Does NOT emit
 *                            'change' — for restoring persisted filters on
 *                            reopen without re-triggering the consumer's own
 *                            filter handler.
 *   setQuery(q)            — replace the search value (trimmed/lowercased);
 *                            updates the input. Does NOT emit 'change'.
 *   appendTrailing(node)   — append a node into the trailing slot (e.g. a
 *                            Refresh button). APPENDS, never mounts — never
 *                            wipes the slot's existing content.
 *   destroy()              — removes every listener this component added.
 */
export const MpiFilterBar = ComponentFactory.create({
    name: 'MpiFilterBar',
    css: ['js/components/Primitives/MpiFilterBar/MpiFilterBar.css'],

    template: (props) => {
        const groups = props.groups || [];
        const searchPlaceholder = props.searchPlaceholder || 'Search…';

        const groupsHtml = groups.map((g, i) => {
            const tagsHtml = (g.options || []).map(opt => `
                <button type="button" class="mpi-filter-bar__tag"
                        data-group="${escapeHtml(g.key)}"
                        data-value="${escapeHtml(opt.value)}"
                        aria-selected="false">${escapeHtml(opt.label)}</button>`).join('');
            const sep = i > 0 ? '<span class="mpi-filter-bar__sep"></span>' : '';
            return `${sep}
                <div class="mpi-filter-bar__group">
                    <span class="mpi-filter-bar__label">${escapeHtml(g.label)}</span>
                    <div class="mpi-filter-bar__tags">${tagsHtml}</div>
                </div>`;
        }).join('');

        return `
            <div class="mpi-filter-bar">
                ${groupsHtml}
                <label class="mpi-filter-bar__search">
                    ${renderIcon('search', 'sm')}
                    <input type="text" class="mpi-filter-bar__search-input"
                           placeholder="${escapeHtml(searchPlaceholder)}"
                           aria-label="${escapeHtml(searchPlaceholder)}"
                           autocomplete="off" />
                </label>
                <div class="mpi-filter-bar__trail"></div>
            </div>`;
    },

    setup: (el, props, emit) => {
        const groups = props.groups || [];
        const _active = new Map(groups.map(g => [g.key, new Set()]));
        let _query = '';

        const searchInput = qs('.mpi-filter-bar__search-input', el);
        const trailEl = qs('.mpi-filter-bar__trail', el);
        const _unsubs = [];

        const _emitChange = (key) => {
            const active = {};
            groups.forEach(g => { active[g.key] = new Set(_active.get(g.key)); });
            emit('change', { key, active, query: _query });
        };

        _unsubs.push(on(el, 'click', (e) => {
            const btn = e.target.closest('.mpi-filter-bar__tag');
            if (!btn) return;
            const groupKey = btn.dataset.group;
            const set = _active.get(groupKey);
            if (!set) return;
            const value = btn.dataset.value;
            const next = btn.getAttribute('aria-selected') !== 'true';
            btn.setAttribute('aria-selected', next ? 'true' : 'false');
            if (next) set.add(value); else set.delete(value);
            _emitChange(groupKey);
        }));

        _unsubs.push(on(searchInput, 'input', () => {
            _query = (searchInput.value || '').trim().toLowerCase();
            _emitChange('search');
        }));

        el.setActive = (key, values) => {
            const set = _active.get(key);
            if (!set) return;
            set.clear();
            (values || []).forEach(v => set.add(v));
            qsa('.mpi-filter-bar__tag', el).forEach(btn => {
                if (btn.dataset.group !== key) return;
                btn.setAttribute('aria-selected', set.has(btn.dataset.value) ? 'true' : 'false');
            });
        };

        el.setQuery = (q) => {
            _query = String(q ?? '').trim().toLowerCase();
            searchInput.value = _query;
        };

        el.appendTrailing = (node) => {
            if (node) trailEl.appendChild(node);
        };

        el.destroy = () => {
            _unsubs.forEach(fn => fn?.());
        };
    }
});
