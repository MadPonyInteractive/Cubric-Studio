'use strict';

/**
 * services/injectionRules.js — the ComfyUI injection-rule checks for ONE API-format graph
 * (.claude/rules/comfy_injection.md). Two callers:
 *   - scripts/validate-injection-rules.mjs, the converter gate (with /object_info);
 *   - services/userFlows.js, the Flow-package validator (MPI-532), which runs inside the
 *     shipped app where no engine may be up and `scripts/` is not packaged — hence this
 *     module lives here and the class check is optional.
 *
 * Checks (all report the offending node and say to re-title in ComfyUI. Agents MAY
 * author workflow JSON since 2026-08-22, but a converted API file is BUILD OUTPUT —
 * patch the raw graph and re-convert, or the next convert silently reverts you):
 *   1. Capture node: >=1 node titled Output_* (media captures are Output_Image /
 *      Output_Video / Output_Preview; a text workflow captures e.g. Output_prompt).
 *   2. Seed convention (MPI-257): if any node exposes a noise_seed widget, a node
 *      titled "Input_Seed" must exist — else the seedless-dedupe guard mis-fires.
 *   3. Converter integrity: no link points at a node not in the graph, and (only when
 *      `objectInfo` is given) every node class is known to the engine.
 *   3b. Input_* / Output_* titles are unique.
 *   4. Every Input_* node reaches an Output_* node.
 */

// A capture is any Output_* node. Not every workflow produces pixels — image_descriptor
// captures text on a PreviewAny titled `Output_prompt`, and Apps ship side outputs
// alongside their media. The app reads back BY TITLE PREFIX (it injects Input_* and
// reads Output_*), so the prefix is the actual contract; demanding one of the three
// media titles made a text-output workflow unrepresentable. This matches what the
// reachability check below (§4) has always done — it already treats any Output_* as a
// valid terminus.
const isCaptureTitle = (title) => /^output_/i.test(title);

const titleOf = (node) => node?._meta?.title || '';
const isLink = (v) => Array.isArray(v) && v.length === 2 && typeof v[1] === 'number';

/**
 * Returns an array of violation strings for one API workflow object.
 * @param {object} wf - API-format graph
 * @param {object|null} [objectInfo] - ComfyUI /object_info; null skips the class check
 */
function checkWorkflow(wf, objectInfo = null) {
  const violations = [];
  const nodes = Object.entries(wf).filter(([, n]) => n && typeof n === 'object' && n.class_type);

  // 1. Capture node present — any Output_* counts, since a workflow may legitimately
  // capture text (image_descriptor -> Output_prompt) rather than pixels.
  const hasCapture = nodes.some(([, n]) => isCaptureTitle(titleOf(n)));
  if (!hasCapture) {
    violations.push(
      `no capture node — every workflow needs a result node titled Output_* (Output_Image / ` +
      `Output_Video / Output_Preview for media, or e.g. Output_prompt for a text result). ` +
      `Title the result node in the ComfyUI graph and re-export.`
    );
  }

  // 2. Seed convention — a noise_seed anywhere ⇒ an Input_Seed node must exist.
  const hasNoiseSeed = nodes.some(([, n]) => n.inputs && 'noise_seed' in n.inputs);
  const hasInputSeed = nodes.some(([, n]) => titleOf(n).toLowerCase() === 'input_seed');
  if (hasNoiseSeed && !hasInputSeed) {
    violations.push(
      `a sampler exposes noise_seed but no node is titled "Input_Seed" (MPI-257). Without it the ` +
      `seedless-dedupe guard mis-fires and blocks re-runs. Add/title an Input_Seed node feeding noise_seed and re-export.`
    );
  }

  // 3. Converter integrity — unknown node class + dangling links. We do NOT re-check
  // "required inputs present": the converter already resolves widget defaults and
  // omits inputs equal to their default (ComfyUI fills them at runtime), so a
  // present-vs-object_info.required diff produces false positives (e.g. the optional
  // `channel` on MpiLoadImageFromPath, a linked `images` slot). The converter throws
  // on a genuinely broken graph; here we only catch what survives into the API JSON.
  for (const [id, node] of nodes) {
    if (objectInfo && !objectInfo[node.class_type]) {
      violations.push(`node ${id} class "${node.class_type}" is not in /object_info — install the custom node or it was renamed.`);
    }
    for (const [k, v] of Object.entries(node.inputs || {})) {
      if (isLink(v) && !(String(v[0]) in wf)) {
        violations.push(`node ${id} (${node.class_type}) input "${k}" links to node ${v[0]} which is not in the graph (dangling).`);
      }
    }
  }

  // 3b. Title uniqueness — the app resolves injection slots BY TITLE (models.js
  // injectionPrefix, e.g. 'Lora_Low' -> Input_Lora_Low_1..6), so two nodes sharing a title
  // means only one resolves and the rest silently swallow their value. Check 4 below cannot
  // see this: duplicate-titled nodes are all properly wired, so every one of them reaches a
  // capture node. This shipped undetected in wan22_i2v, where nodes 793-798 were all titled
  // Input_Lora_Low_1 and Low LoRA slots 2-6 did nothing. Output_* collides the same way on
  // read-back (numbered captures Output_Image_2/_3). Only Input_*/Output_* are checked —
  // ordinary graph nodes reuse titles freely and are none of our business.
  const byTitle = new Map();
  for (const [id, node] of nodes) {
    const title = titleOf(node);
    if (!/^(input|output)_/i.test(title)) continue;
    const key = title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(id);
  }
  for (const [key, ids] of byTitle) {
    if (ids.length < 2) continue;
    violations.push(
      `${ids.length} nodes share the title "${key}" (nodes ${ids.join(', ')}) — the app injects by ` +
      `title, so only one resolves and the others silently discard their value. Give each a unique ` +
      `title in the ComfyUI graph (e.g. _1, _2, _3) and re-export.`
    );
  }

  // 4. Injection reachability — every Input_* node must have a live path to a capture
  // node. The app injects BY TITLE and never checks the graph, so an Input_* that feeds
  // nothing (or feeds only a dead branch) accepts the value and silently drops it: the
  // user picks an image, the model never sees it, and there is no error anywhere.
  // Bypassed/muted nodes are already stripped by the converter, so a slot that routed
  // through one arrives here orphaned — which is exactly how qwen_edit's Input_Image_2
  // died (MPI-300: it fed a bypassed ImageResizeKJv2, caught only by hand-tracing links).
  const consumersOf = new Map();   // producer id -> [consumer id]
  for (const [id, node] of nodes) {
    for (const v of Object.values(node.inputs || {})) {
      if (!isLink(v)) continue;
      const src = String(v[0]);
      if (!consumersOf.has(src)) consumersOf.set(src, []);
      consumersOf.get(src).push(id);
    }
  }
  // Any Output_* counts as a terminus here, same rule as check 1 above: Apps ship
  // numbered captures (Output_Image_2/_3) and side outputs (Output_prompt), and a slot that
  // feeds one of those is genuinely wired. Check 1 above still demands a primary capture.
  const captureIds = new Set(nodes.filter(([, n]) => /^output_/i.test(titleOf(n))).map(([id]) => id));
  const reaches = (startId) => {
    const seen = new Set([startId]);
    const stack = [startId];
    while (stack.length) {
      const cur = stack.pop();
      if (captureIds.has(cur)) return true;
      for (const next of consumersOf.get(cur) || []) {
        if (!seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    return false;
  };
  // A refiner stage runs its sampler with `add_noise: false`, which makes that sampler's
  // noise_seed a dead input — so an Input_Seed feeding nothing is CORRECT there, not a
  // dropped injection (MPI-303: wan22_i2v_stage2 was filed as a bug on exactly this and
  // closed as not-a-bug; stage 2 refines stage 1's latent, all variance comes from
  // stage 1's seed). Exempt Input_Seed only when no sampler in the graph could consume a
  // seed at all; any live noise_seed means a real Input_Seed orphan is still a real bug.
  const anySeedConsumer = nodes.some(([, n]) =>
    n.inputs && 'noise_seed' in n.inputs && n.inputs.add_noise !== false
  );
  for (const [id, node] of nodes) {
    const title = titleOf(node);
    if (!/^input_/i.test(title)) continue;
    if (title.toLowerCase() === 'input_seed' && !anySeedConsumer) continue;
    if (!reaches(id)) {
      violations.push(
        `node ${id} titled "${title}" never reaches a capture node — the app will inject into it ` +
        `and the value is silently discarded. Reconnect it in the ComfyUI graph (or drop the node) and re-export.`
      );
    }
  }

  return violations;
}

module.exports = { checkWorkflow, titleOf };
