/**
 * cloudEditGraph.js — the two passes that move a Flow's edit stage to a cloud model (MPI-918).
 *
 * A Flow runs its edit model as ONE stage inside a ComfyUI graph (crop, edit, stitch,
 * composite). A cloud model cannot run inside the graph, so the graph runs twice around it:
 *
 *   pass 1  the graph up to the edit stage only: hands back the exact picture the local edit
 *           model would have received (`Output_Display`, never a card) and the exact prompt
 *           it would have encoded (`Output_prompt`).
 *   pass 2  the whole graph with the edit stage's output node REPLACED by the cloud picture,
 *           fitted to the size the local decode would have produced, so every node after it
 *           (stitch, composite, colour match) runs exactly as it does locally.
 *
 * Both passes PRUNE to what their outputs reach. Not tidiness: ComfyUI validates every node
 * an output can reach before it runs any of them, so a local loader left wired behind a
 * switch refuses the whole prompt ("value not in list") for a user without that model,
 * who is exactly the user a cloud pick is for. Pruned, the local model never loads and is
 * never checked.
 *
 * A FlowDef opts in with `cloudEdit: { input, prompt, output }`, three node ids of its graph:
 * the picture the edit stage takes, the prompt it encodes, and the node whose IMAGE output
 * (slot 0) is the edited picture.
 */

'use strict';

/** Ids for the nodes the passes add. Far above any id a shipped graph uses. */
const LOAD_ID = '918001';
const SHOW_ID = '918002';
const TEXT_ID = '918003';

/** The `Input_*` title pass 2's loader carries; the app stages the cloud picture into it. */
export const CLOUD_RESULT_TITLE = 'Input_Cloud_Result';

/** Every node `ids` depend on, `ids` included. A link is `[nodeId, slot]`. */
function _ancestors(workflow, ids) {
    const keep = new Set();
    const stack = ids.map(String);
    while (stack.length) {
        const id = stack.pop();
        if (keep.has(id) || !workflow[id]) continue;
        keep.add(id);
        for (const v of Object.values(workflow[id].inputs || {})) {
            if (Array.isArray(v) && v.length === 2 && (typeof v[0] === 'string' || typeof v[0] === 'number')) {
                stack.push(String(v[0]));
            }
        }
    }
    return keep;
}

function _only(workflow, keep) {
    return Object.fromEntries(Object.entries(workflow).filter(([id]) => keep.has(id)));
}

function _assertSpec(workflow, spec, keys) {
    for (const key of keys) {
        if (!workflow[String(spec?.[key])]) throw new Error(`cloudEdit.${key} names node ${spec?.[key]}, which this graph does not have`);
    }
}

/**
 * Pass 1: the graph up to the edit stage, tapped. Every original output is gone, so nothing
 * this pass makes can land as a card.
 * @param {Object} workflow - API-format graph, already injected
 * @param {{input: string, prompt: string}} spec
 * @returns {Object} a new graph
 */
export function cloudEditPass1(workflow, spec) {
    _assertSpec(workflow, spec, ['input', 'prompt']);
    const out = _only(workflow, _ancestors(workflow, [spec.input, spec.prompt]));
    out[SHOW_ID] = { class_type: 'PreviewImage', inputs: { images: [String(spec.input), 0] }, _meta: { title: 'Output_Display' } };
    out[TEXT_ID] = { class_type: 'PreviewAny', inputs: { source: [String(spec.prompt), 0] }, _meta: { title: 'Output_prompt' } };
    return out;
}

/**
 * Pass 2: the cloud picture stands where the edit stage's output was. The node keeps its id,
 * so every link into it now reads the fitted cloud picture; the local branch behind it is
 * reached by nothing and pruned.
 * @param {Object} workflow - API-format graph, already injected
 * @param {{output: string}} spec
 * @param {{width: number, height: number}} size - what the local edit would have produced
 * @returns {Object} a new graph; the caller sets `Input_Cloud_Result` to the picture
 */
export function cloudEditPass2(workflow, spec, { width, height }) {
    _assertSpec(workflow, spec, ['output']);
    const out = { ...workflow };
    // Nano Banana answers ~1K at a snapped ratio whatever it is sent, so the fit is what
    // makes the stitch downstream line up. A Klein result is already this size.
    out[String(spec.output)] = {
        class_type: 'ImageScale',
        inputs: { image: [LOAD_ID, 0], upscale_method: 'lanczos', width, height, crop: 'disabled' },
        _meta: { title: 'Cloud Edit Fit' },
    };
    out[LOAD_ID] = {
        class_type: 'MpiLoadImage',
        inputs: { image: 'None', channel: 'alpha', block_if_empty: true, string: '' },
        _meta: { title: CLOUD_RESULT_TITLE },
    };
    const roots = Object.keys(out).filter(id => /^output_/i.test(out[id]?._meta?.title || ''));
    return _only(out, _ancestors(out, roots));
}
