/**
 * modelUpdateCheck — tells the user once per app session that an installed model is
 * missing files, and so is hidden from the model pickers (MPI-1065).
 *
 * "Installed" is every dep on disk now, with no install receipt, so an update that adds a
 * dep to a model the user already has (LTX 2.3's Ingredients LoRA, MPI-1060) drops it out
 * of every picker with no message. The repair already exists: the Models library shows the
 * model as partial and its Install button fetches the rest. This only says so. It never
 * downloads anything itself: Install keeps the licence gates and the engine scoping.
 *
 * "Missing files" needs 1 GB of weights only THIS model uses on disk (proof it was installed,
 * or an install was started), then reads the Models library's own partial answer
 * (`partialInstall`) for what is left. A model the user never touched never qualifies.
 */
import { Events } from '../events.js';
import { formatBytes } from '../utils/formatBytes.js';
import { partialInstall, depSizeBytes } from '../data/modelConstants/resolveModelDeps.js';

const _shown = new Set();

/**
 * The toast text for `[{ name, missingBytes }]`.
 * @param {{name: string, missingBytes: number}[]} models
 * @returns {string}
 */
export function missingFilesMessage(models) {
    const list = models.map(m => `${m.name} (${formatBytes(m.missingBytes)})`);
    const names = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0];
    const one = models.length === 1;
    return `${names} ${one ? 'is' : 'are'} missing files from an update, so ${one ? 'it is' : 'they are'} hidden from the model pickers. Open Models and press Install to get ${one ? 'it' : 'them'} back.`;
}

/**
 * The local models an update left missing files, `[{ id, name, missingBytes }]`, in `models`
 * order. A dep another USABLE model owns is on disk regardless of this one (MpiModelManager
 * `_sharedOwnedDepIds`), so it is neither this model's progress nor its missing work.
 * Shared deps cannot say a model was installed either: once a sibling stops being usable too
 * (one dep added to both LTX tiers), the Gemma CLIP and VAEs the user got for one tier sit
 * unowned on disk, and the other tier read "missing files" without ever being installed.
 * Only weights NO other model uses (its transformer) prove the install.
 * @param {object[]} models - local ModelDefs (no cloud models)
 * @param {{universe: Function, statusOf: Function, isUsable: Function, deps: object}} ctx
 * @returns {{id: string, name: string, missingBytes: number}[]}
 */
export function modelsMissingFiles(models, { universe, statusOf, isUsable, deps }) {
    const onDisk = st => st === true || st?.installed === true;
    const owned = new Set();
    const users = new Map();
    for (const m of models) {
        const status = isUsable(m) ? statusOf(m.id) : null;
        for (const id of universe(m)) {
            users.set(id, (users.get(id) || 0) + 1);
            if (status && onDisk(status.get(id))) owned.add(id);
        }
    }
    const missing = [];
    for (const m of models) {
        if (isUsable(m)) continue;
        const status = statusOf(m.id);
        const ownOnDisk = universe(m).filter(id => users.get(id) === 1 && onDisk(status?.get(id)))
            .reduce((n, id) => n + depSizeBytes(deps[id]?.size), 0);
        if (ownOnDisk < 1024 ** 3) continue;
        const p = partialInstall(universe(m).filter(id => !owned.has(id)).map(id => deps[id]), status);
        if (!p.hasPartialProgress) continue;
        // The tier only where two cards share a name (LTX 2.3 High / Balanced).
        const twin = m.sizeTier && models.some(o => o !== m && o.name === m.name);
        const tier = twin ? ` ${m.sizeTier[0].toUpperCase()}${m.sizeTier.slice(1)}` : '';
        missing.push({ id: m.id, name: m.name + tier, missingBytes: p.totalBytes - p.downloadedBytes });
    }
    return missing;
}

async function _check() {
    // Loaded here, not at the top: the pure helpers above stay importable under node.
    const [{ MODELS, isModelUsable, getModelDepStatus }, { DEPS }, { resolveFullUniverse },
        { remoteEngineClient }, { state }] = await Promise.all([
        import('../data/modelRegistry.js'),
        import('../data/modelConstants/dependencies.js'),
        import('../data/modelConstants/resolveModelDeps.js'),
        import('../services/remoteEngineClient.js'),
        import('../state.js'),
    ]);
    const engine = remoteEngineClient.effectiveEngine();
    const busy = new Set((state.downloadJobs || []).map(j => j.modelId));
    const missing = modelsMissingFiles(MODELS.filter(m => !m.provider), {
        universe: m => resolveFullUniverse(m, null, engine, { arch: remoteEngineClient.archSync(engine) }),
        statusOf: getModelDepStatus,
        isUsable: isModelUsable,
        deps: DEPS,
    }).filter(m => !_shown.has(m.id) && !busy.has(m.id));
    if (!missing.length) return;
    for (const m of missing) _shown.add(m.id);
    const { StatusBar } = await import('./statusBar.js');
    StatusBar.notify(missingFilesMessage(missing), 'warning', 15000, {
        action: { text: 'Open Models', onClick: () => Events.emit('models:open') },
    });
}

/** Called once by shell.js at boot. */
export function start() {
    // eslint-disable-next-line mpi/require-destroy-on-events -- app-lifetime listener; starts once at boot
    Events.on('models:checked', () => { _check(); });
}
