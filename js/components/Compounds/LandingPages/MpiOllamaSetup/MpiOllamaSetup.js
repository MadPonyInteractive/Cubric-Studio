import { ComponentFactory } from '../../../factory.js';
import { MpiButton } from '../../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar } from '../../../Primitives/MpiProgressBar/MpiProgressBar.js';
import {
    ollamaState,
    startOllama,
    installOllama,
    pullOllamaModel,
} from '../../../../services/llmService.js';
import { formatBytes } from '../../../../utils/formatBytes.js';
import { openExternal } from '../../../../utils/openExternal.js';
import { qs } from '../../../../utils/dom.js';

/**
 * MpiOllamaSetup — the Ollama row under the Language Models backend picker
 * (MPI-728 phase 3).
 *
 * Gets Ollama to where an enhance can run on it, one honest state at a time: not
 * installed, installing, starting, running without the chosen model, downloading
 * it, ready. MpiLlmSettings mounts it only while Ollama is the picked backend.
 *
 * NOTHING HEAVY HAPPENS WITHOUT A CLICK (Fabio, 2026-09-13). Mounting it STARTS a
 * stopped Ollama, because starting an app the user already installed asks nothing
 * of them. Installing Ollama and downloading a model are buttons, and the click is
 * the consent: no toast about a download already under way, no popup on every pick.
 *
 * The work runs in the server (`services/ollamaLifecycle.js`), so closing the panel
 * does not stop a download, and the row picks the progress back up when it opens.
 */

const DOWNLOAD_PAGE = 'https://ollama.com/download';
const POLL_MS = 1000;

export const MpiOllamaSetup = ComponentFactory.create({
    name: 'MpiOllamaSetup',
    css: ['js/components/Compounds/LandingPages/MpiOllamaSetup/MpiOllamaSetup.css'],

    template: () => `
        <div class="mpi-ollama-setup">
            <span class="mpi-settings__hint mpi-ollama-setup__status"></span>
            <div class="mpi-ollama-setup__progress" hidden></div>
            <div class="mpi-ollama-setup__action"></div>
        </div>`,

    setup: (el, props, emit) => {
        let _modelId = props.modelId || '';
        let _timer = null;
        let _destroyed = false;
        let _bar = null;
        let _button = null;

        const status = qs('.mpi-ollama-setup__status', el);
        const progressSlot = qs('.mpi-ollama-setup__progress', el);
        const actionSlot = qs('.mpi-ollama-setup__action', el);

        el.setModel = (id) => {
            _modelId = id || '';
            _refresh();
        };

        el.destroy = () => {
            _destroyed = true;
            clearTimeout(_timer);
            _button?.el?.destroy?.();
            _bar?.el?.destroy?.();
        };

        _refresh();

        /** One read of `/llm/ollama`, painted. Polls again only while something is running. */
        async function _refresh() {
            clearTimeout(_timer);
            const state = await ollamaState();
            if (_destroyed) return;
            if (!state) {
                _paint('Could not read the state of Ollama.', { text: 'Try again', onClick: _refresh });
                return;
            }
            emit('state', state);

            if (state.install?.status === 'installing') {
                _paint('Installing Ollama. This takes a few minutes and about 3 GB of disk space.');
                _poll();
                return;
            }
            if (!state.running) {
                if (state.install?.status === 'failed') {
                    _paint('Ollama could not be installed automatically. Install it from ollama.com, then reopen this panel.',
                        { text: 'Open download page', onClick: () => openExternal(DOWNLOAD_PAGE) });
                    return;
                }
                _start(state.platform);
                return;
            }

            const model = state.models?.[_modelId || state.defaultModelId];
            if (!model) {
                _paint('Ollama is running.');
                return;
            }
            if (model.pull && !model.pull.done) {
                _paintProgress(model);
                _poll();
                return;
            }
            if (model.downloaded) {
                _paint(`Ollama is running, and ${model.name} is downloaded and ready.`);
                return;
            }
            if (model.pull?.error) {
                _paint(`Downloading ${model.name} failed: ${model.pull.error}`, { text: 'Try again', onClick: _pull });
                return;
            }
            const size = model.size ? `, about ${formatBytes(model.size)}` : '';
            _paint(`${model.name} is not in your Ollama yet${size}. Nothing downloads until you press Download.`,
                { text: 'Download', onClick: _pull });
        }

        async function _start(platform) {
            _paint('Starting Ollama…');
            const { status: started } = await startOllama();
            if (_destroyed) return;
            if (started === 'running' || started === 'started') {
                _refresh();
            } else if (started === 'missing' && platform === 'win32') {
                _paint('Ollama is not installed. It is a free app that runs these models on your own card, and it takes about 3 GB of disk space.',
                    { text: 'Install Ollama', onClick: _install });
            } else if (started === 'missing') {
                _paint('Ollama is not installed. It is a free app that runs these models on your own card. Install it from ollama.com, then reopen this panel.',
                    { text: 'Open download page', onClick: () => openExternal(DOWNLOAD_PAGE) });
            } else {
                _paint('Ollama is installed but did not start. Start it yourself, or try again.',
                    { text: 'Try again', onClick: _refresh });
            }
        }

        async function _install() {
            const res = await installOllama();
            if (_destroyed) return;
            // No silent install on this machine: the download page is the honest next step.
            if (!res.ok) {
                openExternal(DOWNLOAD_PAGE);
                return;
            }
            _refresh();
        }

        async function _pull() {
            const res = await pullOllamaModel(_modelId || null);
            if (_destroyed) return;
            if (!res.ok) {
                _paint(res.error || 'The download could not start.', { text: 'Try again', onClick: _pull });
                return;
            }
            _refresh();
        }

        // ponytail: polls on a timer while a download runs, even with the panel
        // closed, one local request a second; stops by itself when it finishes.
        function _poll() {
            _timer = setTimeout(_refresh, POLL_MS);
        }

        function _paint(text, action) {
            status.textContent = text;
            progressSlot.hidden = true;
            _setAction(action);
        }

        function _paintProgress(model) {
            const { completed, total } = model.pull;
            status.textContent = total
                ? `Downloading ${model.name}: ${formatBytes(completed)} of ${formatBytes(total)}.`
                : `Starting the download of ${model.name}…`;
            _setAction(null);
            progressSlot.hidden = false;
            const pct = total ? Math.floor((completed / total) * 100) : 0;
            if (_bar) _bar.el.setValueQuiet(pct);
            else _bar = MpiProgressBar.mount(progressSlot, { value: pct, info: '' });
        }

        function _setAction(action) {
            _button?.el?.destroy?.();
            _button = null;
            actionSlot.innerHTML = '';
            if (!action) return;
            _button = MpiButton.mount(actionSlot, { text: action.text, variant: 'secondary', size: 'sm' });
            _button.on('click', action.onClick);
        }
    },
});
