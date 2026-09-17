/**
 * The `Input_` canonicalization pass (MPI-127 / MPI-252), pure so a test can run it.
 *
 * The whole workflow fleet is Input_ / Output_ titled (tier-1 deprecated), but a few
 * params are still built with the bare control name (Use_End_Image, Upscale_Model,
 * Lora_N, and any control returning a bare key). Injection matches node titles exactly
 * and silently skips a param whose title has no node, so each bare key is renamed to its
 * Input_ form and the bare half dropped. Keys already prefixed pass through untouched.
 *
 * A dotted `Title.widget` key (MPI-359) gets the alias but KEEPS its bare form: it may
 * address a node that is not Input_-titled. The enhancer's `Load CLIP.clip_name` and
 * `Replace Text.replace` did, and the rename sent them to `Input_Load CLIP` and
 * `Input_Replace Text`, which no graph has, so the encoder borrow and the newline
 * override never reached ComfyUI (found live, MPI-774 Phase 4). A bare title with no node
 * is skipped like any other, so `Video_Latent.*` still lands only through its alias.
 *
 * @param {Object<string, *>} params  mutated in place
 * @returns {Object<string, *>} the same object
 */
export function canonicalizeInjectionKeys(params) {
    for (const key of Object.keys(params)) {
        if (key.startsWith('Input_') || key.startsWith('Output_')) continue;
        const aliased = `Input_${key}`;
        if (!(aliased in params)) params[aliased] = params[key];
        if (!key.includes('.')) delete params[key];
    }
    return params;
}
