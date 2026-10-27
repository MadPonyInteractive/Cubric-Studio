/**
 * flowEnhance.js — the ONE place a Flow's prompt enhancement is decided and dispatched (MPI-1002).
 *
 * Two callers, one rule. `MpiBaseFlow` (the component: a hand run, the Enhance button, the
 * Generate-time automatic pass) and `agentDispatch.buildFlow` (the shell: the agent's and a
 * routine's Flow run, through `enhanceFlowRun`) both read a Flow's `enhance` declaration
 * through THESE helpers and dispatch it through `runEnhanceDecl`, which is the only Flow-path
 * caller of `llmService.enhanceFlow`. Before this the pure half lived inside MpiBaseFlow's
 * 3.8k-line closure, where the agent's run could not reach it, so an agent-run Song skipped
 * the enhancer entirely and generated from a caption Cosmo had written by hand.
 *
 * `enhanceFlow` is what follows Remote > Language Models: ComfyUI picked runs the graph,
 * anything else runs that backend and never the graph. Going through `runEnhanceDecl` is
 * therefore what makes an agent run obey the pick, and what puts one log line in app.log
 * naming the backend and model that actually wrote the text.
 *
 * The frame keeps the UI half (`_enhanceWrote`, `_mayEnhanceWrite`, painting); this file
 * holds nothing that touches a DOM node or a component.
 *
 * Its twin, the `describe` step (MPI-1036, bottom of the file), puts a Flow's picture into
 * words on the describer picked in Remote; `submitFlowGeneration` runs it for every caller.
 */

import { enhanceFlow, backendPreference, describeImage, describeBackendPreference, describeModelPreference } from './llmService.js';
import { clientLogger } from './clientLogger.js';
import { formatPrice } from '../data/modelConstants/deepinfraPricing.js';
import { firstFrameDataUrl } from '../utils/video.js';
import { resolveMediaUrl } from '../utils/mediaActions.js';
import { getFlowById, flowModelIds, ruleHolds, flowMediaCtx } from '../data/flowsRegistry.js';
import { mapDeclaredValue, hiddenFieldIds, isInjectionParam } from '../utils/declaredFields.js';
import { storyboardPlanMarkdown } from './storyboardRunner.js';

/**
 * Every field an enhance declaration writes into.
 *
 * `to` is ONE id, or a MARKER → id map when the enhancer's answer is several
 * blocks (MPI-664). Music Maker asks for three — mood, vocal and arrangement —
 * because one 12-row box holding all three read as nothing at all: *"as much as
 * I read it, I still don't know what it is or how to use it"* (Fabio,
 * 2026-09-02). Three labelled boxes filling at once is the same text saying what
 * it is, and it is what makes the button's effect visible.
 *
 * @param {Object} d  an enhance declaration
 * @returns {string[]}
 */
export const enhanceTargets = d => (typeof d.to === 'string' ? [d.to] : Object.values(d.to || {}));

/**
 * The ids that FEED one enhance action.
 *
 * `from` is ONE id, or a LIST of them (MPI-664). Music Maker sends three: the
 * brief, the style phrase and the Instrumental flag. Style has to go because
 * the enhancer writes an arrangement and cannot write one without knowing the
 * genre; Instrumental has to go because otherwise it writes vocal prose for a
 * track that has been told to have no vocals — the same self-contradicting
 * caption the graph's own Instrumental clause used to build.
 *
 * ONE list, not `from` plus a second `context` key, because the list is also
 * the CACHE KEY: these are exactly the fields whose change makes the previous
 * answer stale (see MpiBaseFlow's `_setFlowField`). Two keys would be two lists to keep in
 * step, and the day they disagreed the enhancer would either re-run for
 * nothing or serve a stale answer for a brief that had moved on.
 *
 * @param {Object} d  an enhance declaration
 * @returns {string[]}
 */
export const enhanceSources = d => (Array.isArray(d.from) ? d.from : [d.from]).filter(Boolean);

/**
 * A FLOW-LEVEL enhance declaration (MPI-664), which is the same object as a button field's
 * WITHOUT the button. Music Maker enhances inside Generate and shows no control for it at all
 * (Fabio, 2026-09-02), so there is no field to hang the declaration on — and hanging it on a
 * hidden button would put a dead `<button>` in the DOM to carry data. The synthetic `id` is
 * what the frame's `_enhancing` and `_paintEnhance` key on; nothing ever renders it.
 * `action` and `auto` are implicit: a declaration with no button cannot be pressed, so
 * automatic is the only thing it can mean.
 *
 * @param {Object} flow  a FlowDef
 * @returns {Object|null}
 */
export function autoEnhanceDecl(flow) {
    return flow?.enhance ? { id: 'enhance:auto', action: 'enhance', auto: true, ...flow.enhance } : null;
}

/**
 * Every enhance action a Flow declares, wherever it was declared. One declaration carries all
 * three behaviours — it fills `to`, editing `from` clears `to`, and the button reports which of
 * those is true — so the three can never disagree the way three separate flags would.
 *
 * @param {Object} flow  a FlowDef
 * @returns {Object[]}
 */
export function flowEnhanceDecls(flow) {
    const auto = autoEnhanceDecl(flow);
    return [
        ...(Array.isArray(flow?.fields) ? flow.fields : []),
        ...(flow?.steps || []).flatMap(st => st?.fields || []),
        ...(auto ? [auto] : []),
    ].filter(f => f?.action === 'enhance' && f.from && f.to);
}

/** Every field a Flow declares, flow-level and step-level together (labels + hiddenWhen rules). */
const _declaredPool = flow => [
    ...(Array.isArray(flow?.fields) ? flow.fields : []),
    ...(flow?.steps || []).flatMap(st => st?.fields || []),
].filter(f => f?.id);

const _isBlank = v => !String(v || '').trim();

/**
 * ONE enhance source → the line the model reads for it.
 *
 * 🔴 THE DECLARATION'S OWN SERIALISER, NEVER `String(v)` (MPI-664, 2026-09-11).
 * A `voices` roster's UI value is ROWS — it is held that way so Reuse can rebuild
 * the control — and `String(rows)` is `[object Object],[object Object]`. Sending
 * the cast as a source without this is worse than not sending it: the enhancer
 * reads noise where the singers should be. `mapDeclaredValue` is the very call
 * the graph payload makes, so the cast the rewriter reads and the cast the
 * caption states are ONE string built in ONE place, which is what that helper
 * exists for. Every field type added later arrives serialised for free.
 *
 * `graphValues` is the agent path: `resolveFlowFieldValues` has ALREADY run
 * `mapDeclaredValue` over its values, and a second pass is not always the identity (a
 * `mapTo` range maps twice), so those values are read as they are.
 */
function enhanceSourceLine(f, raw, id, bare, graphValues) {
    const v = graphValues ? raw : mapDeclaredValue(f, raw);
    if (v === false || v === null || v === undefined) return '';
    const label = f?.label || id;
    if (v === true) return label;
    const text = String(v).trim();
    if (!text) return '';
    return bare ? text : `${label}: ${text}`;
}

/**
 * The enhancer's INPUT TEXT, built from every source the declaration names.
 *
 * One source → its text verbatim, which is what every flow before Music Maker
 * sends and what those recipes were written against. Several → one labelled
 * line each, using the field's own on-screen label so the prose the user reads
 * and the prose the model reads name the same things.
 *
 * Empty values are DROPPED rather than sent as an empty label: `Style: ` on its
 * own line is an instruction to write nothing about style, which is the
 * opposite of what a blank Custom box means. A `false` toggle is dropped for
 * the same reason — "Instrumental: no" spends tokens telling a music model that
 * a song has singing in it.
 *
 * 🔴 A HIDDEN SOURCE IS DROPPED TOO (MPI-664, 2026-09-03). A field hidden by
 * `hiddenWhen` keeps its value on purpose — the graph re-checks the flag itself
 * rather than trusting the UI — but that value is no longer part of what the
 * user is ASKING FOR, and the enhancer's input is exactly that. Music Maker
 * proved it on the first vocal run ever attempted: `Input_Structure` is
 * instrumental-only on screen, and switching Instrumental OFF left the previous
 * instrumental plan sitting in it. The enhancer still received
 * `Song structure: Intro: single orchestral drum...`, so a ballad brief came
 * back with a horror trailer's arrangement — orchestral drum, viola section,
 * the lot — and the box that would have let the user clear it was hidden.
 * What the user cannot see is not what they are asking for.
 *
 * @param {Object} d           the enhance declaration
 * @param {Object[]} decls     every declared field of the Flow (labels, `mapDeclaredValue`)
 * @param {Object} values      current values by field id
 * @param {Set<string>} [hidden]  ids hidden RIGHT NOW (`hiddenFieldIds`)
 * @param {Object} [opts]
 * @param {boolean} [opts.graphValues]  `values` are already graph values (the agent path)
 * @returns {string}
 */
export function enhanceSourceText(d, decls, values, hidden = new Set(), { graphValues = false } = {}) {
    const ids = enhanceSources(d).filter(id => !hidden.has(id));
    const byId = new Map((decls || []).map(f => [f.id, f]));
    const bare = ids.length === 1;
    return ids.map(id => enhanceSourceLine(byId.get(id), values?.[id], id, bare, graphValues))
        .filter(Boolean).join('\n');
}

/**
 * Split the enhancer's answer into the declaration's target(s).
 *
 * ONE target takes the whole string. SEVERAL take one MARKED BLOCK each: the
 * recipe answers `[MOOD] … [VOCAL] … [ARRANGEMENT] …` on a single line — the
 * graph's `StringReplace` flattens it and that is deliberate, the blocks are
 * delimited by their markers and never by newlines — so each box claims the run
 * of text from its own marker to whichever marker comes next.
 *
 * `unmarked` is true when a marker map got NO block back. That is NOT an error: a model that
 * ignored the format still wrote usable prose, so the caller puts it all in the first box
 * where the user can see it and move it. That is also the shape the graph already tolerates
 * on the caption side.
 *
 * @param {Object} d     the enhance declaration
 * @param {string} text  the op's answer, trimmed
 * @returns {{ blocks: Array<[string, string]>, unmarked: boolean }}  `[targetId, blockText]`
 */
export function splitEnhanced(d, text) {
    if (typeof d.to === 'string') return { blocks: [[d.to, text]], unmarked: false };
    const blocks = Object.entries(d.to || {}).map(([marker, id]) => [
        id,
        (text.match(new RegExp(`\\[${marker}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`, 'i'))?.[1] || '').trim(),
    ]);
    return { blocks, unmarked: blocks.length > 0 && blocks.every(([, v]) => !v) };
}

/**
 * What an enhancer answer WRITES, as `[targetId, text]` pairs, given which targets may take it.
 *
 * Hand-typed boxes are not targets. `mayWrite` is filtered BEFORE the unmarked fallback so an
 * unmarked answer cannot land on top of the user's first box either. The frame's `mayWrite`
 * is "empty, or text Enhance itself put there"; the agent's is "empty".
 *
 * @param {Object} d
 * @param {string} text
 * @param {(id: string) => boolean} mayWrite
 * @returns {Array<[string, string]>}
 */
export function enhancedWrites(d, text, mayWrite) {
    const { blocks, unmarked } = splitEnhanced(d, text);
    const open = blocks.filter(([id]) => mayWrite(id));
    if (!open.length) return [];
    const as = WRITE_AS[d.writeAs] || (v => v);
    if (unmarked) return [[open[0][0], as(text)]];
    return open.filter(([, v]) => v).map(([id, v]) => [id, as(v)]);
}

/**
 * The shape an answer is written in, by a declaration's `writeAs` (MPI-1305). The hand run, the
 * agent's Flow run and the agent's Storyboard all write through `enhancedWrites`, so one key
 * gives them the same text.
 */
const WRITE_AS = {
    storyboardPlan: storyboardPlanMarkdown,
};

/**
 * Target ids to adopt as the ENHANCER'S at the frame's seed: a declaration whose targets are
 * ALL `hidden: true` and which hold text nobody marked as written by it (MPI-1002, gap 3).
 *
 * A hidden box cannot be typed into, so whatever sits in it is machine output. That is how
 * Song's three caption blocks are declared, and it is what an agent-opened Song arrives with:
 * Cosmo fills them (or an older sidecar has no `enhanceWrote`), the frame seeds them as the
 * USER's text, and at Cue the automatic pass either fills only the blank ones (a mixed
 * caption) or, with all three set, never runs. Adopted, the same text is stale the moment the
 * brief or the cast changes and is refreshed by the ordinary pass, and an unchanged brief runs
 * none.
 *
 * ALL targets, not each one: a declaration with one visible box has a target the user may have
 * typed in, and ownership of a box that can be typed in cannot be inferred after the fact —
 * guessing it would wipe prose the user really did write.
 *
 * @param {Object[]}    decls   enhance declarations
 * @param {Object[]}    allDecls  every declared field (for `hidden`)
 * @param {Object}      values  field values by id
 * @param {Set<string>} owned   target ids already marked as the enhancer's
 * @returns {string[]}
 */
export function adoptHiddenTargets(decls, allDecls, values = {}, owned = new Set()) {
    const byId = new Map((allDecls || []).map(f => [f?.id, f]));
    const out = new Set();
    (decls || []).forEach((d) => {
        const targets = enhanceTargets(d);
        if (!targets.length || !targets.every(id => byId.get(id)?.hidden === true)) return;
        targets.forEach((id) => {
            if (!owned.has(id) && !_isBlank(values[id])) out.add(id);
        });
    });
    return [...out];
}

/**
 * Dispatch ONE enhance declaration — the ONLY Flow-path caller of `enhanceFlow`.
 *
 * `enhanceFlow` runs the backend the user picked in Remote > Language Models (Fabio,
 * 2026-09-13): the ComfyUI graph only when that is the pick, else the server backend with the
 * graph's recipe replayed on the reply. The same arguments ride whether a hand run, the button
 * or the agent got here.
 *
 * Logs ONE line per enhance naming the Flow, the backend that ACTUALLY ran (the result echoes
 * it; `/llm/enhance` itself logs no success line) and the model, so "which enhancer wrote this
 * caption" is answerable from app.log. A failure warns; a user's own Stop stays quiet.
 *
 * @param {Object} d       the enhance declaration
 * @param {string} source  the text to rewrite (`enhanceSourceText`)
 * @param {{flowId?: string}} [ctx]
 * @returns {Promise<{ok:boolean, text?:string, backend?:string, model?:string, error?:string, cancelled?:boolean}>}
 *          Never rejects — `enhanceFlow` resolves `{ ok: false }` on every failure.
 */
export async function runEnhanceDecl(d, source, { flowId } = {}) {
    const started = Date.now();
    const result = await enhanceFlow({
        prompt: source,
        injectionParams: d.injectionParams,
        modelId: d.model || null,
        onAgent: d.runsOn === 'agent',
    });
    const name = getFlowById(flowId)?.title || flowId || d.id;
    if (result.ok && result.text) {
        clientLogger.info('flow-enhance',
            `${name} enhanced on ${result.backend || backendPreference()} (${result.model || 'default model'}), ${Date.now() - started} ms`);
    } else if (!result.ok && !result.cancelled) {
        clientLogger.warn('flow-enhance',
            `${name} enhance failed on ${result.backend || backendPreference()}: ${result.error || 'no answer'}`);
    }
    return result;
}

/** An agent-facing refusal: what the enhancer said, plus where the user fixes it. */
function _enhanceFailure(flow, error, code) {
    const why = String(error || 'It gave no answer.').trim();
    // A child-safety refusal (MPI-1056) is not a broken enhancer: its reason stands alone.
    if (code === 'CHILD_SAFETY') return { ok: false, code, message: why };
    const hint = /Remote > Language Models/.test(why) ? '' : ' Check Remote > Language Models.';
    return {
        ok: false,
        code: 'ENHANCE_FAILED',
        message: `Nothing was generated: the prompt enhancer for ${flow?.title || 'this Flow'} failed. ${why}${/[.!?]$/.test(why) ? '' : '.'}${hint}`,
    };
}

/**
 * The enhance step of an AGENT or ROUTINE Flow run (`agentDispatch.buildFlow`): what the frame's
 * `_autoEnhance` does on a hand run, for a caller that has no widgets.
 *
 * Runs each AUTOMATIC declaration (a button-only one — Character Sheet's Enhance — is a hand
 * action, so the agent running none is parity). A declaration is SKIPPED, calling nothing, when
 * its sources hold no text or when every target already has text: the caller (or a routine
 * snapshot) wrote it and Enhance never overwrites that. Only BLANK targets are written.
 *
 * Returns a PATCH for the caller to merge — `injectionParams` for `Input_*` targets, `inputs`
 * for the rest plus `enhanceWrote` (the ids the enhancer wrote, so the run snapshot lets a
 * Reuse tell machine text from typed text, MPI-664). A Flow with no `enhance`, or nothing to
 * do, returns an empty patch.
 *
 * FAILURE STOPS THE RUN (Fabio, open question 1, pick taken until he says otherwise): a failed,
 * cancelled or empty enhance returns `{ ok: false }` so nothing is generated on the wrong
 * caption. The message carries the enhancer's own error and a Remote > Language Models hint.
 *
 * @param {Object} flow  a FlowDef
 * @param {{inputs?: Object, injectionParams?: Object, mediaItems?: Object[]}} resolved
 *        `resolveFlowFieldValues` output; `mediaItems` is optional media context (D4 MPI-1101)
 * @param {{enhance?: Function}} [deps]  the dispatch; a test stubs it
 * @returns {Promise<{ok: true, injectionParams: Object, inputs: Object}
 *                  |{ok: false, code: 'ENHANCE_FAILED'|'CANCELLED', message: string}>}
 */
export async function enhanceFlowRun(flow, resolved, deps = { enhance: runEnhanceDecl }) {
    const enhance = deps?.enhance || runEnhanceDecl;
    const decls = flowEnhanceDecls(flow).filter(d => d.auto);
    const patch = { injectionParams: {}, inputs: {} };
    if (!decls.length) return { ok: true, ...patch };

    const pool = _declaredPool(flow);
    // A working copy: a second declaration reads what the first wrote, as on a hand run.
    const values = { ...(resolved?.inputs || {}), ...(resolved?.injectionParams || {}) };
    const mediaCtx = flowMediaCtx(resolved?.mediaItems);
    const wrote = new Set();

    for (const d of decls) {
        const hidden = new Set(hiddenFieldIds(pool, values, flowModelIds(flow), mediaCtx));
        const source = enhanceSourceText(d, pool, values, hidden, { graphValues: true });
        if (!source) continue;
        if (!enhanceTargets(d).some(id => _isBlank(values[id]))) continue;

        const result = await enhance(d, source, { flowId: flow?.id });
        if (result?.cancelled) {
            return {
                ok: false,
                code: 'CANCELLED',
                message: `Cancelled while the prompt enhancer was writing the description for ${flow?.title || 'this Flow'}. Nothing was generated.`,
            };
        }
        if (!result?.ok || !String(result.text || '').trim()) {
            return _enhanceFailure(flow, result?.ok ? 'The enhancer returned nothing.' : result?.error, result?.errorCode);
        }

        enhancedWrites(d, String(result.text), id => _isBlank(values[id])).forEach(([id, v]) => {
            values[id] = v;
            (isInjectionParam(id) ? patch.injectionParams : patch.inputs)[id] = v;
            wrote.add(id);
        });
    }

    return {
        ok: true,
        injectionParams: patch.injectionParams,
        inputs: { ...patch.inputs, ...(wrote.size ? { enhanceWrote: [...wrote] } : {}) },
    };
}

// ── The describe step (MPI-1036) ─────────────────────────────────────────────────────────────
//
// A Flow's `describe` declaration puts a picture INTO WORDS before the graph runs. Video Edit
// needs it: MiniMax H3 mostly ignores a reference picture its prompt does not describe (a swap
// kept the clip's own person, a background change kept the clip's room), and the same runs
// passed once the picture was described. The words come from the describer picked in Remote >
// Language Models (`llmService.describeImage`, the one describe switch point), never from a
// describer wired into the graph (Fabio, 2026-10-08).
//
// Entries are `{ to, media, ask, when?, frame? }`; `ask` may be a function of the run's values, for a
// question that names what the user typed (Video Edit's kept {who}, MPI-1154). Per target, the FIRST entry whose media slot
// holds something and whose `when` rules all hold is the one asked; `when` takes the field rules
// every Flow rule takes (`flowsRegistry.ruleHolds`) and `{ media }` (that slot holds something).
// `frame: 'first'` describes a clip's first frame instead of the file; `crop: '<box param>'` only
// the part of the picture that box holds, when the run carries one (a face's turn read off a whole
// torso shot came back FRONT for a turned head, off the boxed face TURNED: MPI-1042 batch 14a).
// `region: { x, y, width, height }` is a FIXED part, in fractions of the picture (a sheet's front body
// view): a 4B describer judging a whole three-view sheet missed what one view showed (MPI-1041).
// `measure: 'sheetCuts'` (no `ask`) reads PIXELS instead (MPI-1086 r44, `sheetCuts`): where a character
// sheet's first two panels end, "x1,x2", or '' when it shows no clear gaps; no describer is asked.
// `everyPass: true` asks it again on every pass of a multi-pass run, of that pass's own picture
// (Make seamless's windows, MPI-1101); flowService does not hand that answer on to the next pass.
// Targets are graph inputs nobody types into, so the text is run-only: it never enters the
// snapshot, and Reuse describes the picture again.
//
// An entry with NO `to` is a CHECK (MPI-1041): `{ media, ask, when?, refuseUnless, code, message }`.
// Every check that holds is asked, before any target, and the run is refused with its `code` and
// `message` unless the whole answer is `refuseUnless` (as the child-safety judge's bare ALLOW: any
// other answer refuses). It is how a Flow refuses on what only the picture can say, such as an
// undressed sheet about to be made a child.

/** One `when` rule against the run's values and the media slots that hold something. */
function _describeRuleHolds(rule, values, roles) {
    if (rule?.media) return roles.has(rule.media);
    return ruleHolds(rule, values);
}

/** A check's answer as bare upper-case words, so "Dressed." passes `DRESSED` and "NOT DRESSED" does not. */
const _answerWords = text => String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[^A-Za-z]+/g, ' ').trim().toUpperCase();

/**
 * The describe entries a run asks: every check that holds, then one per target, the first that
 * holds, and only for a target that is still blank (a caller that wrote one keeps it).
 *
 * @param {Object} flow  a FlowDef
 * @param {Object} [values]  the run's values (`flowRunValues` and its `injectionParams`)
 * @param {Object[]} [mediaItems]  the run's media, each with its slot `role`
 * @returns {Object[]}
 */
export function describeAsks(flow, values = {}, mediaItems = []) {
    const roles = new Set(mediaItems.filter(m => m?.url).map(m => m.role));
    const checks = [];
    const picked = new Map();
    for (const d of flow?.describe || []) {
        if ((d.to && picked.has(d.to)) || !roles.has(d.media)) continue;
        if (![].concat(d.when || []).every(r => _describeRuleHolds(r, values, roles))) continue;
        if (d.to) picked.set(d.to, d);
        else checks.push(d);
    }
    return [...checks, ...[...picked.values()].filter(d => _isBlank(values[d.to]))]
        .map(d => (typeof d.ask === 'function' ? { ...d, ask: d.ask(values) } : d));
}

/**
 * A clip's first frame as a project file the describer can read: grabbed in the renderer and
 * placed in the project's content-addressed store, so it makes no gallery card.
 *
 * @param {string} url  the clip
 * @param {{id?: string, folderPath: string}} project
 * @returns {Promise<string>}  the frame's path
 */
async function stageFirstFrame(url, project) {
    if (!project?.folderPath) throw new Error('No project to keep the frame in.');
    // An agent's media can be a bare file path, which a <video> cannot load.
    return _stagePreview(await firstFrameDataUrl(resolveMediaUrl(url)), project, 'The first frame');
}

/**
 * The part of a picture a box holds, as a project file the describer can read. The box is in
 * source pixels and may hang off an edge (`overflow: 'allow'`), so only what lies inside the
 * picture is kept; a box that misses it describes the whole picture.
 *
 * @param {string} url  the picture
 * @param {{x: number, y: number, width: number, height: number, fractions?: boolean}} box  in
 *        fractions of the picture with `fractions` (a describe `region`)
 * @param {{id?: string, folderPath: string}} project
 * @returns {Promise<string>}  the crop's path, or `url` when the box holds nothing
 */
async function stageBoxCrop(url, box, project) {
    if (!project?.folderPath) throw new Error('No project to keep the crop in.');
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('The picture could not be read.'));
        img.src = resolveMediaUrl(url);
    });
    if (box.fractions) {
        const W = img.naturalWidth, H = img.naturalHeight;
        box = { x: Math.round(box.x * W), y: Math.round(box.y * H), width: Math.round(box.width * W), height: Math.round(box.height * H) };
    }
    const x0 = Math.max(0, box.x), y0 = Math.max(0, box.y);
    const w = Math.min(img.naturalWidth, box.x + box.width) - x0;
    const h = Math.min(img.naturalHeight, box.y + box.height) - y0;
    if (w <= 0 || h <= 0) return url;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, x0, y0, w, h, 0, 0, w, h);
    return _stagePreview(canvas.toDataURL('image/png'), project, 'The boxed part of the picture');
}

/** A data URL into the project's content-addressed preview store (no gallery card). */
async function _stagePreview(dataUrl, project, what) {
    const res = await fetch(
        `/project-media/${project.id || 'agent'}/place-preview-asset?folderPath=${encodeURIComponent(project.folderPath)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl, ext: '.png' }) },
    );
    const data = res.ok ? await res.json() : null;
    if (!data?.success || !data.filePath) throw new Error(`${what} could not be stored in the project.`);
    return data.filePath;
}

// ponytail: answers for the app session, a few hundred bytes each; never evicted, gone on restart.
// A picture edited IN PLACE (same path) keeps its old answer until then; a cap if that ever bites.
const DESCRIBED = new Map();

/**
 * The describe step of a Flow run, on whatever path reached it (`flowService.submitFlowGeneration`
 * calls it for hand, agent and routine runs alike).
 *
 * Returns the described text by target for the caller to merge into the run's `injectionParams`.
 * FAILURE STOPS THE RUN, as a failed enhance does: a picture the prompt does not describe is the
 * very run this step exists to prevent, so nothing is generated and the message names the
 * describer's own error and where it is picked.
 *
 * @param {Object} flow  a FlowDef
 * @param {{injectionParams?: Object, mediaItems?: Object[]}} config  the run as it will be queued
 * @param {?Object} project  where a clip's first frame is kept
 * A repeat run REUSES the answer (Fabio, 2026-10-09: re-describing the same picture every run is
 * "ridiculous", and its wording drifts between runs, so two runs of one setup get different prompts):
 * same picture, crop, frame, question and describer = the cached text.
 *
 * A CHECK that does not pass refuses with its own `code` and `message` (the caller reports both);
 * a describer failure has no code.
 *
 * @param {{describe?: Function, firstFrame?: Function, boxCrop?: Function, cache?: Map}} [deps]  a test stubs them
 * @returns {Promise<{ok: true, injectionParams: Object}|{ok: false, cancelled?: boolean, code?: string, message: string}>}
 */
export async function describeFlowRun(flow, config, project, deps = {}) {
    const describe = deps.describe || describeImage;
    const firstFrame = deps.firstFrame || stageFirstFrame;
    const boxCrop = deps.boxCrop || stageBoxCrop;
    // A stubbed describer caches only when its test hands in a Map: tests share this module.
    const cache = deps.cache || (deps.describe ? null : DESCRIBED);
    const media = config?.mediaItems || [];
    const name = flow?.title || 'this Flow';
    const out = {};
    for (const d of describeAsks(flow, config?.injectionParams, media)) {
        const started = Date.now();
        const url = media.find(m => m?.role === d.media)?.url;
        const box = d.region ? { ...d.region, fractions: true } : d.crop ? config?.injectionParams?.[d.crop] : null;
        const key = JSON.stringify([url, box, d.frame || '', d.ask, describeBackendPreference(), describeModelPreference() || '']);
        const what = d.to || `check ${d.refuseUnless}`;
        // A check that does not get its one passing answer refuses the run, on every path alike.
        const settle = (text) => {
            if (!d.to && _answerWords(text) !== d.refuseUnless) {
                clientLogger.info('flow-describe', `${name} refused by ${what}: the describer answered "${text.slice(0, 60)}"`);
                return { ok: false, code: d.code, message: d.message };
            }
            if (d.to) out[d.to] = text;
            return null;
        };
        if (cache?.has(key)) {
            clientLogger.info('flow-describe', `${name} ${what} reused (same picture and question as an earlier run)`);
            const refused = settle(cache.get(key));
            if (refused) return refused;
            continue;
        }
        // A MEASURE entry reads pixels, not words: no describer, and finding nothing is an answer ('').
        if (d.measure === 'sheetCuts') {
            let cutsText = '';
            try {
                cutsText = await (deps.measure || measureSheetCuts)(url);
            } catch (err) {
                clientLogger.warn('flow-describe', `${name} ${what} could not be measured: ${err?.message}`);
            }
            clientLogger.info('flow-describe', `${name} ${what} measured: ${cutsText || 'no gaps, the default cuts'}`);
            cache?.set(key, cutsText);
            out[d.to] = cutsText;
            continue;
        }
        let result;
        try {
            const imagePath = d.frame === 'first' ? await firstFrame(url, project)
                : box ? await boxCrop(url, box, project) : url;
            result = await describe({ imagePath, question: d.ask });
        } catch (err) {
            result = { ok: false, error: err?.message };
        }
        if (result?.cancelled) {
            return { ok: false, cancelled: true, message: `Cancelled while the picture was being described for ${name}. Nothing was generated.` };
        }
        // The describer can open on stray punctuation (": A young woman ..."): start at the first word.
        const text = String(result?.text || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
        if (!result?.ok || !text) {
            const why = String(result?.error || 'It gave no answer.').trim();
            clientLogger.warn('flow-describe', `${name} ${what} describe failed via ${result?.via || '?'}: ${why}`);
            const hint = /Remote > Language Models|Model Library/.test(why) ? '' : ' Check Remote > Language Models.';
            return { ok: false, message: `Nothing was generated: the picture could not be described for ${name}. ${why}${/[.!?]$/.test(why) ? '' : '.'}${hint}` };
        }
        clientLogger.info('flow-describe', `${name} ${what} described via ${result.via} (${result.model || 'default model'}), ${Date.now() - started} ms`);
        cache?.set(key, text);
        const refused = settle(text);
        if (refused) return refused;
    }
    return { ok: true, injectionParams: out };
}

/**
 * The picture step of an enhance that plans from the user's pictures (`describePictures` on the
 * declaration, Storyboard's Plan with Cosmo, MPI-1231). The planner reads words only, so a picture
 * noted "Sphinx" was drawn as the Egyptian monument and a tiger noted "the protector warrior" got
 * arms (both panel models, 2026-10-25): every picture is described first, note or no note
 * (Fabio), and the planner gets what it shows beside the user's note.
 *
 * Each picture is its own describe job on the Remote pick (`queued`: a queue row and Stop on
 * either backend), one at a time, the answer reused for the same picture and question like
 * `describeFlowRun`'s. A failed or empty describe stops the step, naming the picture.
 *
 * @param {Array<?{url: string}>} items  the pictures by slot (a cleared slot is empty)
 * @param {string} ask  the question each picture is asked
 * @param {{onPicture?: Function, describe?: Function, cache?: Map}} [deps]  `onPicture(n, total)`
 *        before each describe that runs; a test stubs the rest
 * @returns {Promise<{ok: true, looks: string[], costs: number[], reused: number, via?: string, model?: string}
 *          |{ok: false, cancelled?: boolean, message: string}>}  `looks` and `costs` by slot
 */
export async function describePictures(items, ask, deps = {}) {
    const describe = deps.describe || describeImage;
    const cache = deps.cache || (deps.describe ? null : DESCRIBED);
    const slots = (items || []).map((m, i) => (m?.url ? i : -1)).filter(i => i >= 0);
    const looks = [], costs = [];
    let reused = 0, via, model;
    for (const [k, i] of slots.entries()) {
        const url = items[i].url;
        const key = JSON.stringify([url, null, '', ask, describeBackendPreference(), describeModelPreference() || '']);
        if (cache?.has(key)) {
            looks[i] = cache.get(key);
            costs[i] = 0;
            reused++;
            continue;
        }
        deps.onPicture?.(k + 1, slots.length);
        const started = Date.now();
        let result;
        try {
            result = await describe({ imagePath: url, question: ask, queued: true });
        } catch (err) {
            result = { ok: false, error: err?.message };
        }
        if (result?.cancelled) return { ok: false, cancelled: true, message: `Stopped while picture ${i + 1} was being described. Nothing was planned.` };
        const text = String(result?.text || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
        if (!result?.ok || !text) {
            const why = String(result?.error || 'It gave no answer.').trim();
            clientLogger.warn('flow-describe', `picture ${i + 1} describe failed via ${result?.via || '?'}: ${why}`);
            const hint = /Remote > Language Models|Model Library/.test(why) ? '' : ' Check Remote > Language Models.';
            return { ok: false, message: `Nothing was planned: picture ${i + 1} could not be described. ${why}${/[.!?]$/.test(why) ? '' : '.'}${hint}` };
        }
        clientLogger.info('flow-describe', `picture ${i + 1} described via ${result.via} (${result.model || 'default model'}), ${Date.now() - started} ms`);
        cache?.set(key, text);
        looks[i] = text;
        costs[i] = Number(result.costUsd) || 0;
        via = result.via;
        model = result.model;
    }
    return { ok: true, looks, costs, reused, via, model };
}

/**
 * What the picture step cost, said once the plan has landed: the price per picture, or that it
 * ran on this computer, or that every picture was described before.
 *
 * @param {{looks: string[], costs: number[], reused: number, via?: string, model?: string}} step
 * @returns {string}
 */
export function picturesCostLine(step) {
    const described = step.looks.filter(Boolean).length - step.reused;
    if (!described) return 'The pictures were described before, so nothing was spent on them.';
    const s = described === 1 ? '' : 's';
    if (step.via !== 'endpoint') return `Described ${described} picture${s} on this computer first, at no cost.`;
    const paid = step.costs.filter(c => c > 0);
    if (!paid.length) return `Described ${described} picture${s} with ${step.model || 'your describe model'} first; it sent no price.`;
    const each = paid.reduce((a, c) => a + c, 0) / paid.length;
    // `formatPrice`'s one significant figure: four decimals read "$0.0000" for a gemma describe.
    return `Described ${described} picture${s} with ${step.model || 'your describe model'} first, ${formatPrice(each)} a picture.`;
}

/** The width a sheet is measured at: a small copy, as MPI-1086's `research/bench/gaps.py` benched. */
const CUT_W = 448;

/**
 * Where a character sheet's first two panels end, from its pixels (MPI-1086 r44): the middles of the first two
 * runs of EMPTY columns between figures, in fractions of the width, or null. A column is empty when the picture
 * barely changes along it (low activity) AND stays near one colour top to bottom (a plain red dress is calm but
 * not the backdrop). Fixed quarters left a ghost arm on Character Sheet from Images sheets (front 7-24%, back
 * 33-51%); this cut every real sheet of Fabio's 121 in a gap (validation.md r44). Implausible cuts give null.
 *
 * @param {ArrayLike<number>} gray  row-major grey levels, `width` x `height`
 * @param {number} width
 * @param {number} height
 * @returns {?number[]}  `[cut1, cut2]`
 */
export function sheetCuts(gray, width, height) {
    // a 5-column box blur, zero past the edges (numpy's 'same' convolution, as benched)
    const smooth = (arr) => arr.map((_, x) => {
        let s = 0;
        for (let k = x - 2; k <= x + 2; k++) if (k >= 0 && k < arr.length) s += arr[k];
        return s / 5;
    });
    const act = new Array(width).fill(0);
    const mean = new Array(width).fill(0);
    const sq = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
        // the horizontal step to the next column; the last column repeats the one before it
        const nx = x < width - 1 ? x + 1 : x, px = x < width - 1 ? x : x - 1;
        let v = 0, h = 0;
        for (let y = 0; y < height; y++) {
            const p = gray[y * width + x];
            mean[x] += p;
            sq[x] += p * p;
            if (y > 0) v += Math.abs(p - gray[(y - 1) * width + x]);
            h += Math.abs(gray[y * width + nx] - gray[y * width + px]);
        }
        act[x] = Math.max(v / (height - 1), h / height);
    }
    const spread = mean.map((m, x) => Math.sqrt(Math.max(0, sq[x] / height - (m / height) ** 2)));
    const a = smooth(act), s = smooth(spread);
    const p90 = (arr) => { const o = [...arr].sort((u, w) => u - w), i = 0.9 * (o.length - 1), f = Math.floor(i); return o[f] + (o[Math.min(f + 1, o.length - 1)] - o[f]) * (i - f); };
    const ta = 0.25 * p90(a), ts = 0.4 * p90(s);
    // A run counts only once a figure (an ACTIVE column) lies to its left: the margin before the front figure is
    // no gap, even when a calm-but-shaded backdrop column splits it off the left edge (flowCharacterSheet_069: a
    // margin run at 6% became cut 1, failed the check below, and the whole sheet measured no cuts).
    const runs = [];
    let figure = false;
    for (let x = 0; x < width;) {
        if (a[x] < ta && s[x] < ts) {
            const start = x;
            while (x < width && a[x] < ta && s[x] < ts) x++;
            if (figure && x < width && x - start >= 6) runs.push((start + x) / 2 / width);
        } else {
            if (a[x] >= ta) figure = true;
            x++;
        }
    }
    if (runs.length < 2) return null;
    const [c1, c2] = runs;
    return c1 > 0.15 && c1 < 0.4 && c2 > 0.4 && c2 < 0.7 ? [c1, c2] : null;
}

/**
 * A grey picture shrunk by AVERAGING each output pixel's block of source pixels. A canvas downscale skips pixels
 * (aliasing), and that noise hid the narrow gap a front arm leaves (flowCSFI_010: no cuts) where the bench's
 * antialiased resize found it.
 * @param {ArrayLike<number>} gray  row-major, `W` x `H`
 * @returns {Float32Array}  `w` x `h`
 */
export function shrinkGray(gray, W, H, w, h) {
    const out = new Float32Array(w * h);
    for (let oy = 0; oy < h; oy++) {
        const y0 = Math.floor(oy * H / h), y1 = Math.max(y0 + 1, Math.floor((oy + 1) * H / h));
        for (let ox = 0; ox < w; ox++) {
            const x0 = Math.floor(ox * W / w), x1 = Math.max(x0 + 1, Math.floor((ox + 1) * W / w));
            let s = 0;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += gray[y * W + x];
            out[oy * w + ox] = s / ((y1 - y0) * (x1 - x0));
        }
    }
    return out;
}

/**
 * A sheet's two panel cuts in its own pixels, "x1,x2", or '' when it shows no clear gaps (the graph then cuts at
 * 25% / 50%, as before).
 * @param {string} url
 * @returns {Promise<string>}
 */
async function measureSheetCuts(url) {
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('The picture could not be read.'));
        img.src = resolveMediaUrl(url);
    });
    const W = img.naturalWidth, H = img.naturalHeight;
    const w = CUT_W, h = Math.round(H * CUT_W / W);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
    const c = sheetCuts(shrinkGray(gray, W, H, w, h), w, h);
    return c ? c.map(v => Math.round(v * W)).join(',') : '';
}
