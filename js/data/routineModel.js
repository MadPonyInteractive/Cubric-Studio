/**
 * routineModel.js — pure routine schema, normaliser and validator (MPI-970 T1).
 *
 * Schema cubric/routine/v1 { schema, name, summary, steps[], created_at }.
 * Each step is exactly one of:
 *   - model step: { modelId, operation, ratio?, qualityTier?, turbo?, … }
 *   - flow step:  { flowId, fields? }
 *   - tool step:  { operation: "imageUpscale"|…, fields? }  (no modelId, no flowId)
 *
 * Pure: no DOM, no state.js. The server imports this via dynamic import from
 * routes/connector.js to validate a save.
 *
 * @see plan.md § Parallel Batch: Foundations, T1
 */

import { AGENT_TOOL_OPS, toolRun } from '../shell/agentToolOps.js';
import { getCommandMediaInputs, filterMediaInputsForModel } from './commandRegistry.js';
import { resolveNamedParams } from './generationControls.js';
import { resolveFlowFieldValues } from '../utils/declaredFields.js';

export const ROUTINE_SCHEMA = 'cubric/routine/v1';

/** Hard step cap (D6). */
const MAX_STEPS = 10;

/** Tool op keys from AGENT_TOOL_OPS. */
const _TOOL_OP_SET = new Set(AGENT_TOOL_OPS.map(t => t.op));

/** Named params a model step may carry (passed to resolveNamedParams). */
const _MODEL_NAMED_KEYS = ['ratio', 'qualityTier', 'turbo', 'styleSelect', 'stylization', 'duration', 'denoise', 'batch'];

const _bad = (code, message) => ({ ok: false, code, message });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the input/output media kinds for a tagged step.
 *
 * A tagged step is a plain step object spread with a `_kind` field added
 * by the per-step validation loop (`_kind: 'tool'|'model'|'flow'`).
 *
 * Returns `{ inputKind, outputKind, notBatchable }`.
 *   inputKind  — the one required input media type, or null when there is not
 *                exactly one.
 *   outputKind — what the step produces ('image'|'video'|'audio'|null).
 *   notBatchable — true unless the step's op takes exactly ONE required input:
 *                every step runs on the card or the previous step's result (D1),
 *                the stack-run rule of `selectCueAllTargets`. A t2i step (none)
 *                would drop it; a two-input step has no second input to take.
 */
function _stepIO(ts, models, flows) {
    if (ts._kind === 'tool') {
        return { inputKind: 'image', outputKind: 'image', notBatchable: false };
    }

    if (ts._kind === 'flow') {
        const flow = flows.find(f => f.id === ts.flowId);
        if (!flow) return { inputKind: null, outputKind: null, notBatchable: false };
        const allSlots = getCommandMediaInputs(flow.operation);
        // No model to gate against on a flow op — pass null: filterMediaInputsForModel
        // keeps all declared slots when model is null.
        const required = filterMediaInputsForModel(allSlots, null).filter(s => s.required);
        return {
            inputKind: required.length === 1 ? required[0].mediaType : null,
            outputKind: flow.mediaType ?? null,
            notBatchable: required.length !== 1,
        };
    }

    // Model step
    const model = models.find(m => m.id === ts.modelId);
    if (!model) return { inputKind: null, outputKind: null, notBatchable: false };
    const allSlots = getCommandMediaInputs(ts.operation);
    const required = filterMediaInputsForModel(allSlots, model).filter(s => s.required);
    return {
        inputKind: required.length === 1 ? required[0].mediaType : null,
        outputKind: model.mediaType ?? null,
        notBatchable: required.length !== 1,
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Coerce raw input into the canonical schema shape. Does NOT validate — call
 * validateRoutine on the result.
 *
 * @param {*} raw
 * @returns {Object}
 */
export function normalizeRoutine(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
        schema: ROUTINE_SCHEMA,
        name: String(r.name ?? '').trim(),
        summary: String(r.summary ?? '').trim(),
        steps: Array.isArray(r.steps) ? r.steps.map(s => ({ ...(s ?? {}) })) : [],
        created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
    };
}

/**
 * Validate a normalised routine against the live catalogues.
 *
 * `lookups` injects the catalogues so this module stays free of renderer state:
 *   - lookups.models — array of ModelDef objects (from MODELS in models.js)
 *   - lookups.flows  — array of FlowDef objects (from FLOWS in flowsRegistry.js)
 *
 * @param {Object} routine  a normalizeRoutine result (or the same shape)
 * @param {{ models: Object[], flows: Object[] }} lookups
 * @returns {{ ok: true, routine: Object, inputKind: string, outputKind: string|null }
 *          |{ ok: false, code: string, message: string }}
 */
export function validateRoutine(routine, lookups) {
    // ── Schema + structure ────────────────────────────────────────────────────
    if (!routine || typeof routine !== 'object') {
        return _bad('INVALID_ROUTINE', 'Routine must be an object.');
    }
    if (routine.schema !== ROUTINE_SCHEMA) {
        return _bad('INVALID_ROUTINE', `schema must be "${ROUTINE_SCHEMA}".`);
    }
    if (!routine.name) {
        return _bad('INVALID_ROUTINE', 'name is required and must be non-empty.');
    }
    if (!routine.summary) {
        return _bad('INVALID_ROUTINE', 'summary is required and must be non-empty.');
    }
    if (!Array.isArray(routine.steps) || routine.steps.length === 0) {
        return _bad('INVALID_ROUTINE', 'steps must be a non-empty array.');
    }
    if (routine.steps.length > MAX_STEPS) {
        return _bad('TOO_MANY_STEPS',
            `A routine may have at most ${MAX_STEPS} steps (got ${routine.steps.length}).`);
    }

    const models = lookups?.models ?? [];
    const flows = lookups?.flows ?? [];

    // taggedSteps: original step spread with _kind ('tool'|'model'|'flow') added.
    // _kind is local and stripped before the routine is returned.
    const taggedSteps = [];

    // ── Per-step validation ───────────────────────────────────────────────────
    for (let i = 0; i < routine.steps.length; i++) {
        const step = routine.steps[i];
        const n = i + 1;

        if (!step || typeof step !== 'object') {
            return _bad('INVALID_ROUTINE', `Step ${n} must be an object.`);
        }

        // Forbidden fields
        for (const key of ['media', 'cards', 'count']) {
            if (key in step) {
                return _bad('STEP_HAS_MEDIA',
                    `Step ${n}: "${key}" is not allowed inside a step — the runner supplies the input.`);
            }
        }

        const hasModelId = Boolean(step.modelId);
        const hasFlowId = Boolean(step.flowId);
        const isToolOp = !hasModelId && !hasFlowId
            && typeof step.operation === 'string' && _TOOL_OP_SET.has(step.operation);

        if (hasModelId && hasFlowId) {
            return _bad('INVALID_ROUTINE',
                `Step ${n}: send either modelId+operation or flowId, not both.`);
        }
        if (!hasModelId && !hasFlowId && !isToolOp) {
            return _bad('INVALID_ROUTINE',
                `Step ${n}: each step needs modelId+operation, flowId, or a tool operation (${[..._TOOL_OP_SET].join(', ')}).`);
        }

        if (hasModelId) {
            // ── Model step ────────────────────────────────────────────────────
            const model = models.find(m => m.id === step.modelId);
            if (!model) {
                return _bad('UNKNOWN_MODEL', `Step ${n}: no model with id "${step.modelId}".`);
            }
            if (!(model.supportedOps ?? []).includes(step.operation)) {
                return _bad('UNKNOWN_OPERATION',
                    `Step ${n}: "${step.operation}" is not available on ${model.name || step.modelId}.`);
            }
            // Named param validation (ratio, qualityTier, turbo, …). Project is null
            // so unset params land on model defaults rather than any saved bucket.
            const namedIn = {};
            for (const k of _MODEL_NAMED_KEYS) {
                if (k in step) namedIn[k] = step[k];
            }
            const np = resolveNamedParams(null, model, step.operation, namedIn);
            if (!np.ok) return _bad(np.code, `Step ${n}: ${np.message}`);

            taggedSteps.push({ ...step, _kind: 'model' });

        } else if (hasFlowId) {
            // ── Flow step ─────────────────────────────────────────────────────
            const flow = flows.find(f => f.id === step.flowId);
            if (!flow) {
                return _bad('UNKNOWN_FLOW', `Step ${n}: no flow with id "${step.flowId}".`);
            }
            // Validate declared fields. Unknown ids are refused; undeclared keys in
            // the step are silently ignored (a step may carry only `flowId`).
            const fv = resolveFlowFieldValues(flow, step.fields ?? {});
            if (fv.unknown.length > 0) {
                return _bad('INVALID_FIELD',
                    `Step ${n}: unknown field(s) for ${flow.title || step.flowId}: ${fv.unknown.join(', ')}.`);
            }

            taggedSteps.push({ ...step, _kind: 'flow' });

        } else {
            // ── Tool step ─────────────────────────────────────────────────────
            // toolRun returns IMAGE_NOT_FOUND for crop/downscale when natural=null
            // (pixel size unknown at validate time) — treat that as fields legal.
            const run = toolRun(step.operation, step.fields ?? {}, null);
            if (!run.ok && run.code !== 'IMAGE_NOT_FOUND') {
                return _bad(run.code, `Step ${n}: ${run.message}`);
            }
            taggedSteps.push({ ...step, _kind: 'tool' });
        }
    }

    // ── Media-kind chain (stack-run rule) ─────────────────────────────────────
    const ios = taggedSteps.map(ts => _stepIO(ts, models, flows));

    for (let i = 0; i < ios.length; i++) {
        const io = ios[i];
        const n = i + 1;
        if (io.notBatchable) {
            return _bad('NOT_BATCHABLE',
                `Step ${n}: a routine step must take exactly one picture, video or sound (the card, or the previous step's result); this one takes none or several.`);
        }
        if (i > 0) {
            const prevOut = ios[i - 1].outputKind;
            if (prevOut !== io.inputKind) {
                return _bad('MEDIA_KIND_BREAK',
                    `Step ${n} expects ${io.inputKind} input but step ${i} produces ${prevOut ?? 'unknown'}.`);
            }
        }
    }

    // Strip the internal _kind marker before returning
    const cleanSteps = routine.steps.map(s => {
        const { _kind, ...rest } = s;
        return rest;
    });

    return {
        ok: true,
        routine: { ...routine, steps: cleanSteps },
        inputKind: ios[0].inputKind,
        // What each result card ends on: its newest version is the last step's output, and
        // a stack reads a member's kind off that selected version (`stackableKind`).
        outputKind: ios[ios.length - 1].outputKind,
    };
}

/**
 * The one plain-words line the agent's `list` shows:
 * "<name> — <summary> (<step1> → <step2> → …)"
 *
 * Each step is identified by its shortest meaningful label:
 *   tool step  → op name (e.g. "imageUpscale")
 *   model step → modelId/operation (e.g. "klein-4b/i2i")
 *   flow step  → flow id (e.g. "scribble-object")
 *
 * @param {Object} routine
 * @returns {string}
 */
export function routineSummary(routine) {
    const chain = (routine.steps ?? []).map(s => {
        if (s.flowId) return s.flowId;
        if (s.modelId) return `${s.modelId}/${s.operation}`;
        return s.operation ?? '?';
    }).join(' → ');
    return `${routine.name} — ${routine.summary}${chain ? ` (${chain})` : ''}`;
}
