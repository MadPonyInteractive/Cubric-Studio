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
 */

import { enhanceFlow, backendPreference } from './llmService.js';
import { clientLogger } from './clientLogger.js';
import { getFlowById, flowModelIds } from '../data/flowsRegistry.js';
import { mapDeclaredValue, hiddenFieldIds, isInjectionParam } from '../utils/declaredFields.js';

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
    if (unmarked) return [[open[0][0], text]];
    return open.filter(([, v]) => v);
}

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
function _enhanceFailure(flow, error) {
    const why = String(error || 'It gave no answer.').trim();
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
 * @param {{inputs?: Object, injectionParams?: Object}} resolved  `resolveFlowFieldValues` output
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
    const wrote = new Set();

    for (const d of decls) {
        const hidden = new Set(hiddenFieldIds(pool, values, flowModelIds(flow)));
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
            return _enhanceFailure(flow, result?.ok ? 'The enhancer returned nothing.' : result?.error);
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
