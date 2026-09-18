/**
 * navigation.js — Routing logic and workspace loading.
 *
 * Navigation model (history-stack based, see router.js):
 *   PAGE_LANDING      → project picker
 *   PAGE_GALLERY      → main gallery (grid of ItemGroups); default on project open
 *   PAGE_GROUP_HISTORY → history view for a single ItemGroup (params: { groupId })
 *
 * Hold Tab for the radial (MPI-811) — four fixed destinations on the diagonals:
 * Gallery (top-left), Projects (bottom-left), Flows (top-right) and your latest
 * workspace (bottom-right). It replaces the MPI-378 → MPI-611 Tab flipper: the
 * ring reaches every stop that ring had, plus the landing page, and one key cannot
 * be both a tap-flipper and a hold-menu. The remembered card still lives in
 * project.json (`lastGroupId`) so it survives a restart, and the Flows leg still
 * restores the flow you PARKED rather than opening a fresh library. Ctrl+Tab stays
 * the dev radial; Models is reached from the prompt box's model button.
 */

import { state } from '../state.js';
import { Events } from '../events.js';
import { refreshProject as refreshProjectStats, refreshGroup as refreshGroupStats } from '../services/projectStatsService.js';
import { APP_CONFIG } from '../../dev_configs/app_config.js';
import { gid, qs } from '../utils/dom.js';
import { navigate, back, clearHistory, PAGE_LANDING, PAGE_GALLERY, PAGE_GROUP_HISTORY } from '../router.js';
import { MpiRadialMenu } from '../components/Primitives/MpiRadialMenu/MpiRadialMenu.js';
import { resolveFlipTarget } from '../data/projectModel.js';
import { updateProject } from '../services/projectService.js';
import { loadProjectGrid, releaseProjectGrid } from './projectUI.js';
import { Overlays } from '../managers/overlayManager.js';
import { clientLogger } from '../services/clientLogger.js';
import { remoteEngineClient } from '../services/remoteEngineClient.js';
import { recordAudioIntoProject } from '../components/Compounds/MpiAudioRecorder/MpiAudioRecorder.js';
import { MpiGalleryToolbar } from '../components/Compounds/MpiGalleryToolbar/MpiGalleryToolbar.js';
import { getEngine } from '../services/comfyController.js';

// ── Module-scoped refs ──────────────────────────────────────────────────────

let _radialInstance   = null;
let _radialMount      = null;   // dedicated persistent container for the radial
let _projectNameInst  = null;
let _galleryToolbarInst = null;
let _toolContainer    = null;
let _appShell         = null;
let _currentPage      = null;
let _currentGroupId   = null;
let _pageLanding      = null;
let _currentBlock     = null;   // track mounted view Block for teardown
let _restartPending   = false;  // a restart is armed, waiting for the queue to drain (MPI-805)
let _navSeq           = 0;      // guards async teardown/import ordering

// ── Public init ─────────────────────────────────────────────────────────────

/**
 * Initializes navigation refs and hooks into the router.
 * @param {Object} refs - DOM references from shell.js
 */
export function initNavigation(refs) {
    _toolContainer   = refs.toolContainer;
    _radialMount     = refs.radialMount;
    _appShell        = refs.appShell;
    _pageLanding     = refs.pageLanding;
    _projectNameInst = refs.projectNameInstance;

    // Up-arrow — navigates up one level (not back in history stack)
    // group-history → gallery, gallery → landing
    _projectNameInst.on('up', () => {
        if (state.currentPage === PAGE_GROUP_HISTORY) {
            navigate(PAGE_GALLERY);
        } else {
            navigate(PAGE_LANDING);
        }
    });

    // Gallery breadcrumb — always goes to main gallery
    _projectNameInst.on('gallery', () => navigate(PAGE_GALLERY));

    // MPI-589: the quick route to Flows, now that the library is no longer dev-gated.
    // The bar emits; opening is the shell's business, and `flows:open` already carries
    // the no-engine guard.
    _projectNameInst.on('flows', () => Events.emit('flows:open'));

    // MPI-678: Record moved here from the gallery toolbar. `recordAudioIntoProject()`
    // is self-contained — it shows the recorder, uploads, and emits `media:imported`
    // itself — so the shell calls it directly, the way MpiMediaPicker already does.
    // Visibility is gated to the gallery in _updateBreadcrumb; see the note there.
    _projectNameInst.on('record', () => {
        recordAudioIntoProject().catch((err) => {
            clientLogger.warn('navigation', `recording failed: ${err?.message || err}`);
        });
    });
}

// ── Radial destinations (MPI-811) ───────────────────────────────────────────

/**
 * The four user destinations, on the diagonals Fabio asked for. Rebuilt on every
 * open (`will-open`) because the latest-workspace leg depends on live project
 * state — a project with no cards, or a remembered card since deleted, dims it.
 */
function _userRadialItems() {
    return [
        // 'grid', not 'gallery': the radial fills its icon paths, and `gallery` is one of
        // the registry's stroke-only entries (icons.js § renderIcon), so it fills to a
        // solid blob. Keep radial icons to fill-based names.
        { action: 'gallery',   label: 'Gallery',   icon: 'grid',   angle: -135 },
        { action: 'projects',  label: 'Projects',  icon: 'folder',  angle:  135 },
        { action: 'flows',     label: 'Flows',     icon: 'layers',  angle:  -45 },
        {
            action:   'workspace',
            label:    'Latest Workspace',
            icon:     'image',
            angle:    45,
            disabled: !resolveFlipTarget(state.currentProject),
        },
    ];
}

/**
 * Gets off whatever Flow surface is on screen before a radial destination that is
 * a PAGE. MPI-611's rule survives: the open flow is PARKED (`flow:suspend` hides
 * it, it is not destroyed), so the Flows leg drops you back into it mid-step.
 * Flows are overlays rather than pages, so this asks the DOM, not
 * `state.currentPage`.
 */
function _leaveFlowSurface() {
    if (qs('.mpi-base-flow')) {
        Events.emit('flow:suspend');
        return;
    }
    if (qs('.mpi-overlay--body .mpi-flow-library')) Events.emit('ui:close-flows');
}

/**
 * Records the card the flipper returns to. Called from the ONE choke point that
 * every card-entry path goes through (this router mounting MpiGroupHistoryBlock),
 * so restore-on-boot and any future entry path are covered without new hooks.
 * @param {string} groupId
 */
function _rememberGroup(groupId) {
    if (!state.currentProject || state.currentProject.lastGroupId === groupId) return;
    updateProject({ lastGroupId: groupId }).catch(err =>
        clientLogger.warn('navigation', `Could not remember the last card: ${err.message}`));
}

// ── Core router handler ─────────────────────────────────────────────────────

/**
 * Core navigation router — called by shell.js on every route change.
 * @param {string} page
 * @param {Object} [params]
 */
export async function handleNavigation(page, params = {}) {
    const navToken = ++_navSeq;

    if (page === PAGE_LANDING) {
        clearHistory();
        Overlays.reset();
        _syncGalleryToolbar(PAGE_LANDING);
        // Tear down radial so the next project entry re-mounts fresh.
        if (_radialInstance) {
            _radialInstance.destroy?.();
            _radialMount.innerHTML = '';
            _radialInstance = null;
        }
        // Tear down mounted view block if it exists
        await _destroyCurrentBlock();
        if (navToken !== _navSeq) return;
        _showLanding();
        loadProjectGrid();
        updateTitlebarProject();
        return;
    }

    if (page === PAGE_GALLERY) {
        _showShell();
        updateTitlebarProject();
        await _loadView(PAGE_GALLERY, params, navToken);
        return;
    }

    if (page === PAGE_GROUP_HISTORY) {
        _showShell();
        updateTitlebarProject();
        await _loadView(PAGE_GROUP_HISTORY, params, navToken);
    }
}

/**
 * Forces a titlebar sync with current state.
 */
export function updateTitlebarProject() {
    if (!_projectNameInst) return;
    _projectNameInst.el.setProjectName(state.currentProject?.name || '');
}

async function _destroyCurrentBlock() {
    if (!_currentBlock) return;

    const block = _currentBlock;
    _currentBlock = null;

    try {
        if (block.el && typeof block.el.destroy === 'function') {
            await block.el.destroy();
            block.el.remove?.();
        } else {
            await block.destroy?.();
        }
    } catch (err) {
        clientLogger.error('navigation', 'destroy() threw for previous block', err);
    }
}

// ── View loader ─────────────────────────────────────────────────────────────

/**
 * Loads the correct workspace into _toolContainer and syncs the breadcrumb.
 * @param {string} page   - PAGE_GALLERY | PAGE_GROUP_HISTORY
 * @param {Object} params - Route params (e.g. { groupId } for group-history)
 */
async function _loadView(page, params = {}, navToken = _navSeq) {
    // ── Dev radial (Ctrl+Tab, dev builds only) ──────────────────────────────
    _syncRadial();

    // ── Page content ────────────────────────────────────────────────────────
    Overlays.reset();

    // Tear down previously mounted block before clearing DOM.
    await _destroyCurrentBlock();
    if (navToken !== _navSeq) return;
    _toolContainer.innerHTML = '';
    _toolContainer.style.position = 'relative';

    if (params.view === 'components') {
        _updateBreadcrumb(page, params);
        return _loadComponentsGallery();
    }

    try {
        const mod = await _importView(page);
        if (navToken !== _navSeq) return;
        if (mod?.mount) {
            _currentBlock = mod.mount(_toolContainer, params);
        }
        // Only update breadcrumb after successful mount — prevents "cleared
        // breadcrumb + stale view" state when mount throws.
        _updateBreadcrumb(page, params);
        // Same reason the breadcrumb waits: only remember a card that actually opened.
        if (page === PAGE_GROUP_HISTORY && params.groupId) _rememberGroup(params.groupId);
    } catch (err) {
        clientLogger.error('navigation', `Failed to load view "${page}"`, err);
    }
}

function _updateBreadcrumb(page, params) {
    _syncGalleryToolbar(params?.view === 'components' ? null : page);
    _currentPage = page;
    _currentGroupId = params?.groupId || null;
    if (page === PAGE_GALLERY) {
        _projectNameInst.el.setBackLabel('Projects');
        _projectNameInst.el.setGalleryLabel('');
        _projectNameInst.el.setGroupLabel('');
        const ps = state.projectStats || { count: 0, bytes: 0 };
        _projectNameInst.el.setStats({ count: ps.count, bytes: ps.bytes, label: 'ASSETS' });
        // MPI-678: Record is GALLERY-ONLY, and this is the branch that already knows
        // which page we are on. The ORIGINAL reason is gone (MPI-723): the ItemGroup
        // build left MpiGalleryBlock for the app-lifetime mediaImportService, so a
        // recording made from group-history now becomes a card like any other import.
        // The gate stays only because nobody has decided what Record should DO from
        // the history page — lifting it is a product call, not a technical one.
        _projectNameInst.el.setRecordVisible(true);
        refreshProjectStats();
    } else if (page === PAGE_GROUP_HISTORY) {
        const group = state.currentProject?.itemGroups?.find(g => g.id === params.groupId);
        _projectNameInst.el.setBackLabel('Gallery');
        _projectNameInst.el.setGalleryLabel('');
        _projectNameInst.el.setGroupLabel(group?.customName || group?.name || 'Group');
        const hs = state.historyStats || { count: 0, bytes: 0 };
        const initialCount = (hs.groupId === group?.id) ? hs.count : (group?.history?.length || 0);
        const initialBytes = (hs.groupId === group?.id) ? hs.bytes : 0;
        _projectNameInst.el.setStats({ count: initialCount, bytes: initialBytes, label: 'ENTRIES' });
        _projectNameInst.el.setRecordVisible(false);
        if (group) refreshGroupStats(group);
    }
}

/**
 * MPI-749: the gallery's view controls (MpiGalleryToolbar) sit in the project bar's
 * toolbar slot on the GALLERY page only. MpiProjectName is app-lifetime, so this file,
 * which already gates Record by page, owns the mount. Idempotent: a project switch
 * re-enters the gallery and must not mount a second toolbar.
 * @param {string|null} page - null for any non-gallery surface (the components view)
 */
function _syncGalleryToolbar(page) {
    const slot = _projectNameInst?.el.getToolbarSlot?.();
    if (!slot) return;
    if (page === PAGE_GALLERY) {
        if (!_galleryToolbarInst) _galleryToolbarInst = MpiGalleryToolbar.mount(slot, {});
        return;
    }
    if (!_galleryToolbarInst) return;
    _galleryToolbarInst.el.destroy();
    _galleryToolbarInst = null;
    slot.replaceChildren();
}

// MPI-805. A model-folder change asks for a restart (MPI-800 dropped the live
// reload route), and the only other way to restart is the dev-only radial below —
// so Settings needs a way in. An event rather than an export: a Compound reaching
// into a shell module for behaviour is what Events is for.
// eslint-disable-next-line mpi/require-destroy-on-events -- app-lifetime listener
Events.on('engine:restart', () => _restartEngine());

// React to stats updates pushed by the stats service.
// eslint-disable-next-line mpi/require-destroy-on-events -- app-lifetime listener
Events.on('state:changed', ({ key, value }) => {
    if (!_projectNameInst) return;
    if (key === 'projectStats' && _currentPage === PAGE_GALLERY) {
        _projectNameInst.el.setStats({ count: value.count, bytes: value.bytes, label: 'ASSETS' });
    } else if (key === 'historyStats' && _currentPage === PAGE_GROUP_HISTORY) {
        if (value.groupId === _currentGroupId) {
            _projectNameInst.el.setStats({ count: value.count, bytes: value.bytes, label: 'ENTRIES' });
        }
    }
});

/**
 * Dev-gated radial action: restart ONLY the ComfyUI engine (no app reload).
 * Remote → wrapper's /proxy/restart-comfy (restarts the Pod's ComfyUI subprocess).
 * Local → stop + start the local ComfyUI process (start is idempotent, spawns fresh).
 */
// MPI-310 — the MPI-308 `_describeFirstChip` dev harness lived here. It answered the
// question it existed for (the caption is worth having), so the feature shipped as a
// real op: right-click a gallery card or history item → "Describe image". The harness
// is gone rather than kept alongside it — it bypassed both the queue and the plugin
// install gate, so it would have failed deep inside ComfyUI once the weight became
// optional. See js/utils/describeAction.js.

async function _restartEngine() {
    const remote = remoteEngineClient.isRemote();
    const engine = getEngine(!remote);
    // MPI-501: a restart terminates ComfyUI — on a running queue that destroys the
    // in-flight prompt with no error anywhere. Same guard as the generation gate.
    // `unreachableMeansIdle` is opted into HERE and in `repairPythonDeps`, and nowhere
    // else: these are the callers where a human has explicitly asked to repair the
    // engine, so an unreadable queue must not lock them out of fixing a wedged ComfyUI.
    // Every app-initiated restart takes the default (refuse), because there nobody asked
    // and the cost is someone's finished work.
    //
    // MPI-805: `timeoutMs: 0` is ONE probe, no sleep — the loop fetches `/queue`, then
    // returns false on the already-passed deadline. It used to be 30000, which meant the
    // button sat SILENT for thirty seconds before the refusal toast appeared. Fabio hit
    // exactly that live (2026-09-18): nothing happened, so he pressed again, and both
    // waits eventually toasted. Whatever this answers, the user hears about it now.
    if (await engine.waitForIdleQueue({ timeoutMs: 0, unreachableMeansIdle: true })) {
        await _performRestart(remote);
        return;
    }
    // Busy. MPI-805, Fabio's call: a restart the user asked for is not refused, it is
    // SCHEDULED — the alternative made them babysit the queue and press again later.
    // A second press while one is armed re-toasts rather than arming a second waiter.
    //
    // ponytail: a single probe cannot tell "busy" from "unreadable" — `waitForIdleQueue`
    // returns one boolean, and it needs three missed reads (~6s) to call an engine
    // unreachable. So a WEDGED engine shows this toast and then restarts about six
    // seconds later, off the armed wait below, which is the repair `unreachableMeansIdle`
    // exists for. The restart still happens and nobody is locked out; only the wording is
    // briefly wrong, on the dev radial, since the Settings button is only reachable with a
    // running engine. Upgrade path if that ever bites: have `waitForIdleQueue` report
    // `'idle' | 'busy' | 'unreachable'` instead of a boolean, and branch the toast on it.
    const alreadyArmed = _restartPending;
    Events.emit('ui:warning', {
        message: 'Restart scheduled for when your generations finish or are cancelled.',
    });
    if (alreadyArmed) return;
    _restartPending = true;
    try {
        // No deadline: the only two ways out are the queue draining and the engine going
        // unreachable, and `unreachableMeansIdle` turns the second into the restart that
        // repairs it. A finite timeout here would drop the user's restart in silence.
        await engine.waitForIdleQueue({ timeoutMs: Infinity, unreachableMeansIdle: true });
        await _performRestart(remote);
    } finally {
        _restartPending = false;
    }
}

/** Stop and start the engine. Callers own the idle guard. */
async function _performRestart(remote) {
    Events.emit('ui:info', { message: 'Restarting the engine…' });
    try {
        if (remote) {
            const r = await fetch('/proxy/restart-comfy', { method: 'POST' });
            if (!r.ok) throw new Error(`restart-comfy ${r.status}`);
        } else {
            await fetch('/comfy/stop', { method: 'POST' });
            // Let the process fully exit before starting, else /comfy/start races the
            // still-dying process, hits its already-running early-return, and never
            // spawns a fresh one (engine wedged, gen gate keeps restarting).
            await new Promise(r => setTimeout(r, 2000));
            const r = await fetch('/comfy/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isUserRestart: true }),
            });
            if (!r.ok) throw new Error(`comfy/start ${r.status}`);
        }
    } catch (err) {
        clientLogger.error('navigation', `Restart engine failed: ${err.message}`);
        Events.emit('ui:error', { title: 'Restart failed', message: `Could not restart the engine: ${err.message}` });
    }
}

/**
 * Mounts the radial on first entry into a workspace.
 *
 * MPI-811 gave it a user ring again (Tab), so this now mounts in production too;
 * the Ctrl+Tab 'dev' context (MPI-338) is the part that stays gated. Models is
 * still reached from the prompt box's model button ('ui:open-model-picker'), not
 * from here.
 *
 * Mounting here rather than for the app's lifetime is what keeps Tab off the
 * landing page: hotkeyManager suppresses native Tab traversal as soon as ANY
 * handler exists for it, and the landing page's project form has real text
 * inputs. The teardown in handleNavigation(PAGE_LANDING) unbinds with it.
 */
function _syncRadial() {
    if (_radialInstance) return;

    _radialInstance = MpiRadialMenu.mount(_radialMount, { context: 'root' });
    _radialInstance.el.setContextItems('root', _userRadialItems());
    // The latest-workspace leg dims as cards come and go, so refresh on every open.
    _radialInstance.on('will-open', () => {
        _radialInstance.el.setContextItems('root', _userRadialItems());
    });

    if (APP_CONFIG.dev_mode) {
        _radialInstance.el.setContextItems('dev', [
            { action: 'components', label: 'Components', icon: 'grid' },
            { action: 'restart-engine', label: 'Restart Engine', icon: 'refresh' },  // restart ComfyUI only
        ]);
    }

    _radialInstance.on('select', ({ action }) => {
        if (action === 'gallery') {
            _leaveFlowSurface();
            // Suspending a flow already revealed the gallery underneath — navigating
            // to the page we are on would tear it down and rebuild it for nothing.
            if (state.currentPage !== PAGE_GALLERY) navigate(PAGE_GALLERY);
            return;
        }
        if (action === 'projects') {
            navigate(PAGE_LANDING);
            return;
        }
        if (action === 'flows') {
            // No-op when nothing is parked; the shell shows synchronously, so the DOM
            // is the answer to "did that work?" — no second flag to keep in sync.
            Events.emit('flow:restore');
            if (!qs('.mpi-base-flow')) Events.emit('flows:open');
            return;
        }
        if (action === 'workspace') {
            const groupId = resolveFlipTarget(state.currentProject);
            if (!groupId) return;   // dimmed item, belt and braces
            _leaveFlowSurface();
            if (state.currentPage === PAGE_GROUP_HISTORY && _currentGroupId === groupId) return;
            navigate(PAGE_GROUP_HISTORY, { groupId });
            return;
        }
        if (action === 'components') {
            _loadComponentsGallery();
            return;
        }
        if (action === 'restart-engine') {
            _restartEngine();
            return;
        }
    });
}

// ── Lazy view imports ───────────────────────────────────────────────────────

/**
 * Lazy-imports a view Block by route name.
 * Returns an object with a `mount(container, params)` method.
 * @param {string} view
 * @returns {Promise<{mount: function}>|null}
 */
async function _importView(view) {
    switch (view) {
        case PAGE_GALLERY: {
            const { MpiGalleryBlock } = await import('../components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js');
            return { mount: (container, params) => MpiGalleryBlock.mount(container, params) };
        }
        case PAGE_GROUP_HISTORY: {
            const { MpiGroupHistoryBlock } = await import('../components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js');
            return { mount: (container, params) => MpiGroupHistoryBlock.mount(container, params) };
        }
        default:
            console.warn(`[navigation] Unknown view: "${view}"`);
            return null;
    }
}

async function _loadComponentsGallery() {
    _syncGalleryToolbar(null);
    const { ensureTemplate } = await import('../managers/templateManager.js');
    const { initComponentsPage } = await import('../pages/components.js');

    _toolContainer.innerHTML = '';
    _toolContainer.style.position = '';

    await ensureTemplate('tpl-components');
    const tpl = gid('tpl-components');
    _toolContainer.appendChild(tpl.content.cloneNode(true));

    await initComponentsPage();
}

// ── Page visibility ─────────────────────────────────────────────────────────

function _showLanding() {
    _pageLanding?.classList.remove('hide');
    _appShell?.classList.add('hide');
}

function _showShell() {
    _pageLanding?.classList.add('hide');
    // Hidden, never unmounted — so the project grid has to stop itself (MPI-786).
    releaseProjectGrid();
    _appShell?.classList.remove('hide');
}
