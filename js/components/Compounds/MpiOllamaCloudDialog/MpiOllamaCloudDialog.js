import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { qs } from '../../../utils/dom.js';
import { openExternal } from '../../../utils/openExternal.js';
import { ollamaCloudModels, addOllamaCloudModel } from '../../../services/llmService.js';

/**
 * MpiOllamaCloudDialog — "Add an Ollama Cloud model" (Compound, MPI-1236)
 *
 * Ollama runs some models on its own servers, free up to a resetting allowance on a free
 * Ollama account. The local app reaches one only once its name is added (`ollama pull
 * <name>:cloud`, nothing downloaded), which was a terminal command, and users never touch a
 * terminal. This lists ollama.com's cloud models that can call tools, each with Add, and
 * says whether the Ollama app is signed in, because a cloud model runs on no other.
 *
 * Usage:
 *   const d = MpiOllamaCloudDialog.mount(document.createElement('div'));
 *   d.on('added', ({ id }) => pick(id));
 *   d.el.show();
 *
 * Instance methods (on instance.el):
 *   show() — portals the dialog and (re)reads the list.
 *   hide() — removes it.
 *
 * Emits:
 * 'added' { id } — a model was added to the user's Ollama.
 */
export const MpiOllamaCloudDialog = ComponentFactory.create({
    name: 'MpiOllamaCloudDialog',
    css: ['js/components/Compounds/MpiOllamaCloudDialog/MpiOllamaCloudDialog.css'],

    template: () => `
        <div class="mpi-ollama-cloud" role="dialog" aria-modal="true">
            <div class="mpi-ollama-cloud__title">Add an Ollama Cloud model</div>
            <div class="mpi-ollama-cloud__hint">These run on Ollama's servers, not your graphics card: nothing is downloaded and no VRAM is used. What you send the agent goes to Ollama. They count against your Ollama account's usage, which on the free plan is an allowance that resets.</div>
            <div class="mpi-ollama-cloud__account">
                <span class="mpi-ollama-cloud__account-text" id="account-text"></span>
                <div class="mpi-ollama-cloud__account-actions" id="account-actions"></div>
            </div>
            <div class="mpi-ollama-cloud__list" id="list"></div>
            <div class="mpi-ollama-cloud__status" id="status" hidden></div>
            <div class="mpi-ollama-cloud__actions" id="actions"></div>
        </div>
    `,

    setup: (el, _props, emit) => {
        const modal = MpiModal.mount(document.createElement('div'), { width: 'min(560px, 90vw)' });
        modal.el.appendChild(el);

        const insts = [];
        /** The `GET /llm/ollama/cloud` reply; undefined while it loads. */
        let _state;
        /** The id being added, or null. */
        let _adding = null;
        let _seq = 0;

        const statusEl = qs('#status', el);
        const setStatus = (text) => { statusEl.textContent = text || ''; statusEl.hidden = !text; };

        const button = (slot, props, onClick) => {
            const inst = MpiButton.mount(slot, { variant: 'secondary', size: 'sm', ...props });
            if (onClick) inst.on('click', onClick);
            insts.push(inst);
            return inst;
        };

        function render() {
            insts.splice(0).forEach(i => i.destroy());
            const accountText = qs('#account-text', el);
            const accountActions = qs('#account-actions', el);
            const list = qs('#list', el);
            accountActions.replaceChildren();
            list.replaceChildren();

            if (_state === undefined) {
                accountText.textContent = 'Asking Ollama for its cloud models…';
                insts.push(MpiSpinner.mount(list, { size: 'sm' }));
                return;
            }
            if (!_state?.ok) {
                accountText.textContent = _state?.error || 'Could not reach the app server.';
                button(accountActions, { text: 'Try again' }, load);
                return;
            }
            if (_state.signedIn) {
                accountText.textContent = `Signed in to Ollama${_state.account ? ` as ${_state.account}` : ''}.`;
            } else if (_state.signedIn === false) {
                accountText.textContent = 'Ollama is not signed in. Cloud models need a free Ollama account: sign in, then check again.';
                button(accountActions, { text: 'Sign in', variant: 'primary' }, () => openExternal(_state.signinUrl || 'https://ollama.com/signin'));
                button(accountActions, { text: 'Check again' }, load);
            } else {
                accountText.textContent = 'Ollama is not running. Adding a model starts it.';
            }

            for (const m of _state.models) {
                const row = document.createElement('div');
                row.className = 'mpi-ollama-cloud__row';
                const name = document.createElement('div');
                name.className = 'mpi-ollama-cloud__name';
                name.textContent = m.id;
                if (m.vision) {
                    const meta = document.createElement('span');
                    meta.className = 'mpi-ollama-cloud__meta';
                    meta.textContent = 'sees pictures';
                    name.appendChild(meta);
                }
                const slot = document.createElement('div');
                row.append(name, slot);
                list.appendChild(row);
                if (m.added) button(slot, { text: 'Added', variant: 'ghost', disabled: true });
                else button(slot, { text: _adding === m.id ? 'Adding…' : 'Add', loading: _adding === m.id, disabled: Boolean(_adding) || _state.signedIn === false }, () => add(m.id));
            }
        }

        async function load() {
            const seq = ++_seq;
            _state = undefined;
            setStatus('');
            render();
            const json = await ollamaCloudModels();
            if (seq !== _seq) return;
            _state = json;
            render();
        }

        async function add(id) {
            _adding = id;
            setStatus('');
            render();
            const res = await addOllamaCloudModel(id);
            _adding = null;
            if (res?.ok) {
                _state = { ..._state, models: _state.models.map(m => (m.id === id ? { ...m, added: true } : m)) };
                setStatus(`Added ${id}. It is now your agent model.`);
                emit('added', { id });
            } else {
                setStatus(`Could not add ${id}: ${res?.error || 'no answer from the app server.'}`);
            }
            render();
        }

        // Mounted once, outside `insts`, which every render empties.
        const close = MpiButton.mount(qs('#actions', el), { text: 'Close', variant: 'primary', size: 'md' });
        close.on('click', () => el.hide());

        el.show = () => { modal.el.show(); load(); };
        el.hide = () => modal.el.hide();
        el.destroy = () => {
            insts.forEach(i => i.destroy());
            close.destroy();
            modal.el.hide();
        };
    },
});
