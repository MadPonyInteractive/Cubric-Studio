/**
 * llmPickCheck — on project open, tells the user once per app session that a language
 * model one of their jobs runs on is not downloaded in their Ollama yet (MPI-993).
 *
 * Only the Ollama connection is checked: it is the one Remote provider the user installs
 * models into, and a hosted catalogue already IS what can run. The list is the one the
 * Remote panel reads (`/llm/connection/models`, which flags a recommended model Ollama lacks
 * `installed: false`). When Ollama does not answer the list fails and the check says
 * nothing: it never starts Ollama to ask. The toast names the Remote tab and carries a
 * button that opens it, because a user back after a while may not remember where it lives.
 */
import { Events } from '../events.js';
import { Storage } from '../core/storage.js';
import {
    backendPreference,
    endpointModelPreference,
    describeBackendPreference,
    describeModelPreference,
} from '../services/llmService.js';

const JOB_LABELS = { enhance: 'prompt enhancement', describe: 'image description', agent: 'agent' };

let _shown = false;

/**
 * The picks that would fail for want of a download, `[{ job, model }]`. `picks` is
 * `{ [job]: saved id or '' }` for each job the connection runs; '' is the connection's
 * recommended model, as the server resolves it. Missing = Ollama does not list the model,
 * or lists it only as a recommendation it has not downloaded (`installed: false`).
 */
export function missingOllamaPicks(models, picks) {
    const missing = [];
    for (const [job, saved] of Object.entries(picks)) {
        const model = saved || models.find(m => m.recommendedFor?.includes(job))?.id;
        if (!model) continue;
        const row = models.find(m => m.id === model);
        if (!row || row.installed === false) missing.push({ job, model });
    }
    return missing;
}

/** The toast text for a non-empty `missing`. */
export function missingPicksMessage(missing) {
    const where = 'from the Remote tab on the home screen, under Language Models.';
    if (missing.length === 1) {
        const [{ job, model }] = missing;
        return `Your ${JOB_LABELS[job]} model, ${model}, is not downloaded in Ollama yet. Download it ${where}`;
    }
    const list = missing.map(({ job, model }) => `${model} (${JOB_LABELS[job]})`).join(', ');
    return `${missing.length} of your language models are not downloaded in Ollama yet: ${list}. Download them ${where}`;
}

/** `{ [job]: saved id or '' }` for each job that runs on the connection right now. */
function _picks() {
    // The agent runs only on the connection; the other two only when their backend is Remote.
    const picks = { agent: Storage.getAgentPrefs().model || '' };
    if (backendPreference() === 'endpoint') picks.enhance = endpointModelPreference() || '';
    if (describeBackendPreference() === 'endpoint') picks.describe = describeModelPreference() || '';
    return picks;
}

async function _check() {
    if (_shown || Storage.getLlmConnection().profileId !== 'ollama') return;
    let json = null;
    try { json = await (await fetch('/llm/connection/models?profileId=ollama')).json(); } catch { return; }
    if (!json?.ok) return;
    const missing = missingOllamaPicks(json.models || [], _picks());
    if (!missing.length || _shown) return;
    _shown = true;
    // Loaded here, not at the top: the two pure helpers above stay importable under node.
    const [{ StatusBar }, { MpiRemote }] = await Promise.all([
        import('./statusBar.js'),
        import('../components/Blocks/MpiRemote/MpiRemote.js'),
    ]);
    StatusBar.notify(missingPicksMessage(missing), 'warning', 15000, {
        action: { text: 'Open Remote', onClick: () => Events.emit('slide-over:open', { title: 'Remote', component: MpiRemote }) },
    });
}

/** Called once by shell.js at boot. */
export function start() {
    // eslint-disable-next-line mpi/require-destroy-on-events -- app-lifetime listener; starts once at boot
    Events.on('project:changed', () => { _check(); });
}
