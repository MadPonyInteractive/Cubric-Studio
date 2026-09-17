// MPI-800: replace every app media slot in comfy_workflows/raw/*.json with ONE MpiNodes
// Upload node (MpiLoadImage / MpiLoadVideoUpload / MpiLoadAudioUpload).
//
//   node upload_slots.mjs            dry run: report, write nothing
//   node upload_slots.mjs --write    rewrite the raw files in place
//
// A slot is an ACTIVE loader (MpiLoadImageFromPath / MpiLoadVideo / MpiLoadAudio) that is
//   DIRECT: titled Input_* with its `string` unwired, or
//   FED:    `string` <- MpiAnyChecker.any <- MpiString titled Input_* (or MpiString directly).
// The Upload node takes the LOADER's id, pos, flags and order, the slot's title, and every
// link the loader's outputs had (same slots); the checker's has_value links move to `loaded`.
// The checker and the MpiString are deleted with their links. No other node is created.
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'C:/AI/Mpi/Cubric-Vision';
const RAW = path.join(REPO, 'comfy_workflows/raw');
const DONOR = 'G:/ComfyUi/ComfyUI/user/default/workflows/mpi800_donor.json';
const PIN = 'cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa';
const SKIP = new Set(['gif_cutout_birefnet.json']);            // a peer's untracked file
const BENCH_INPUT = 'g:\\comfyui\\comfyui\\input\\';
const WRITE = process.argv.includes('--write');

const UPLOAD_OF = { MpiLoadImageFromPath: 'MpiLoadImage', MpiLoadVideo: 'MpiLoadVideoUpload', MpiLoadAudio: 'MpiLoadAudioUpload' };
const LOADED = { MpiLoadImage: 4, MpiLoadVideoUpload: 8, MpiLoadAudioUpload: 1 };
const isSlotTitle = (t) => typeof t === 'string' && t.toLowerCase().startsWith('input_');

const donorWf = JSON.parse(fs.readFileSync(DONOR, 'utf8'));
const DONORS = {};
for (const n of donorWf.nodes) if (Object.values(UPLOAD_OF).includes(n.type)) DONORS[n.type] = n;
for (const t of Object.values(UPLOAD_OF)) if (!DONORS[t]) throw new Error(`donor has no ${t}`);

// ── serialisation: reproduce the file's own writer, or refuse ────────────────
// Numbers keep their source text (a Python writer leaves `12.0`; JS would print `12`).
const parse = (txt) => JSON.parse(txt, (k, v, ctx) =>
    (typeof v === 'number' && ctx?.source !== undefined && ctx.source !== String(v)) ? JSON.rawJSON(ctx.source) : v);

function violations(wf) {
    const out = [];
    const ids = new Map(wf.nodes.map((n) => [n.id, n]));
    for (const l of wf.links) {
        const o = ids.get(l[1]); const t = ids.get(l[3]);
        if (!o || !t) { out.push(`link ${l[0]} dangles`); continue; }
        if (!(o.outputs?.[l[2]]?.links || []).includes(l[0])) out.push(`link ${l[0]} missing on origin #${o.id}[${l[2]}]`);
        if (t.inputs?.[l[4]]?.link !== l[0]) out.push(`link ${l[0]} missing on target #${t.id}[${l[4]}]`);
    }
    const linkIds = new Set(wf.links.map((l) => l[0]));
    for (const n of wf.nodes) {
        for (const i of n.inputs || []) if (i.link != null && !linkIds.has(i.link)) out.push(`#${n.id} input ${i.name} -> dead link ${i.link}`);
        for (const o of n.outputs || []) for (const id of o.links || []) if (!linkIds.has(id)) out.push(`#${n.id} output ${o.name} -> dead link ${id}`);
    }
    return out;
}

function serializer(txt) {
    const obj = parse(txt);
    const crlf = txt.includes('\r\n');
    const asciiOnly = !/[^\x00-\x7f]/.test(txt);
    for (const ind of [2, 1, 4, '\t', undefined]) {
        for (const tailNl of [true, false]) {
            const ser = (o) => {
                let s = JSON.stringify(o, null, ind);
                if (asciiOnly) s = s.replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
                if (crlf) s = s.replace(/\n/g, '\r\n');
                return tailNl ? s + (crlf ? '\r\n' : '\n') : s;
            };
            if (ser(obj) === txt) return ser;
        }
    }
    return null;
}

// ── one file ─────────────────────────────────────────────────────────────────
function convertFile(file) {
    const txt = fs.readFileSync(file, 'utf8');
    const ser = serializer(txt);
    const wf = parse(txt);
    const baseline = new Set(violations(parse(txt)));
    const log = [];
    if (wf.definitions?.subgraphs?.length) return { log: ['SKIP: has subgraphs'], changed: false };

    const nodes = new Map(wf.nodes.map((n) => [n.id, n]));
    const links = new Map(wf.links.map((l) => [l[0], l]));
    const before = new Map(wf.nodes.map((n) => [n.id, JSON.stringify({ pos: n.pos, size: n.size, mode: n.mode })]));
    const outsOf = (nid, slot) => wf.links.filter((l) => l[1] === nid && l[2] === slot);
    const dropLinks = new Set();
    const dropNodes = new Set();
    let changed = false;

    for (const L of wf.nodes) {
        const newType = UPLOAD_OF[L.type];
        if (!newType) continue;
        const strIn = (L.inputs || []).find((i) => i.name === 'string');
        const otherLinked = (L.inputs || []).some((i) => i.name !== 'string' && i.link != null);
        let title, colorSrc = L, hasLinks = [], chainDrop = [], chainNodes = [];

        if (strIn?.link == null) {
            if (!isSlotTitle(L.title)) continue;                                   // not an app slot
            title = L.title;
        } else {
            const l1 = links.get(strIn.link);
            const O = nodes.get(l1[1]);
            let S = O, lS = l1;
            if (O?.type === 'MpiAnyChecker') {
                const anyIn = O.inputs.find((i) => i.name === 'any');
                if (anyIn?.link == null) { log.push(`REVIEW #${L.id}: checker #${O.id} has no input`); continue; }
                lS = links.get(anyIn.link);
                S = nodes.get(lS[1]);
                const passTo = outsOf(O.id, 0);
                if (passTo.length !== 1 || passTo[0][0] !== l1[0]) { log.push(`REVIEW #${L.id}: checker #${O.id} pass-through feeds more than this loader`); continue; }
                if (O.mode !== 0) { log.push(`REVIEW #${L.id}: checker #${O.id} mode ${O.mode}`); continue; }
                hasLinks = outsOf(O.id, 1);
                chainDrop.push(l1[0]);
                chainNodes.push(O.id);
            }
            if (S?.type !== 'MpiString' || !isSlotTitle(S.title)) {
                if (isSlotTitle(S?.title) || O?.type === 'MpiAnyChecker') log.push(`REVIEW #${L.id}: fed by ${S?.type} #${S?.id} ${JSON.stringify(S?.title)}`);
                continue;
            }
            if (S.mode !== 0 || L.mode !== 0) { log.push(`LEFT #${L.id} ${JSON.stringify(S.title)}: mode loader=${L.mode} string=${S.mode}`); continue; }
            if (outsOf(S.id, lS[2]).length !== 1) { log.push(`REVIEW #${L.id}: MpiString #${S.id} ${S.title} feeds more than one node`); continue; }
            chainDrop.push(lS[0]);
            chainNodes.push(S.id);
            title = S.title;
            colorSrc = S.color || S.bgcolor ? S : L;
        }
        if (L.mode !== 0) { log.push(`LEFT #${L.id} ${JSON.stringify(title)}: loader mode ${L.mode}`); continue; }
        if (otherLinked) { log.push(`REVIEW #${L.id} ${title}: a non-string input is wired`); continue; }

        // widget values of the old loader
        const wv = L.widgets_values || [];
        const baked = typeof wv[0] === 'string' ? wv[0] : '';
        const picker = baked.toLowerCase().startsWith(BENCH_INPUT) && !baked.slice(BENCH_INPUT.length).includes('\\')
            ? baked.slice(BENCH_INPUT.length) : 'None';
        let values, named;
        if (newType === 'MpiLoadImage') {
            values = [picker, wv[1] ?? 'alpha', wv[2] ?? true, '', 'image'];
            named = { image: values[0], channel: values[1], block_if_empty: values[2], string: '', upload: 'image' };
        } else if (newType === 'MpiLoadVideoUpload') {
            values = [picker, wv[1] ?? true, wv[2] ?? 0, '', 'image'];
            named = { video: values[0], block_if_empty: values[1], force_rate: values[2], string: '', upload: 'image' };
        } else {
            values = [picker, wv[1] ?? true, '', null, null];
            named = { audio: values[0], block_if_empty: values[1], string: '', upload: null };
        }

        const D = structuredClone(DONORS[newType]);
        const outputs = D.outputs.map((o, k) => {
            const old = (L.outputs || [])[k];
            if (old && old.type !== o.type) throw new Error(`${path.basename(file)} #${L.id}: output ${k} type ${old.type} vs ${o.type}`);
            const own = old?.links ? [...old.links] : [];
            const extra = k === LOADED[newType] ? hasLinks.map((l) => l[0]) : [];
            const all = [...own, ...extra];
            return { ...o, links: all.length ? all : (old ? old.links : null) };
        });
        if ((L.outputs || []).length > D.outputs.length) throw new Error(`${path.basename(file)} #${L.id}: more outputs than ${newType}`);
        for (const l of hasLinks) { l[1] = L.id; l[2] = LOADED[newType]; }

        const U = {
            id: L.id,
            type: newType,
            pos: L.pos,
            size: [Math.max(L.size?.[0] ?? 0, D.size[0]), Math.max(L.size?.[1] ?? 0, D.size[1])],
            flags: L.flags ?? {},
            order: L.order,
            mode: 0,
            inputs: D.inputs.map((i) => ({ ...i, link: null })),
            outputs,
            title,
            properties: { ...D.properties, ver: PIN },
            widgets_values: values,
            widgets_values_named: named,
        };
        if (colorSrc.color) U.color = colorSrc.color;
        if (colorSrc.bgcolor) U.bgcolor = colorSrc.bgcolor;
        wf.nodes[wf.nodes.indexOf(L)] = U;
        nodes.set(L.id, U);
        chainDrop.forEach((id) => dropLinks.add(id));
        chainNodes.forEach((id) => dropNodes.add(id));
        changed = true;
        log.push(`${chainNodes.length ? 'FED   ' : 'DIRECT'} #${L.id} ${L.type} -> ${newType} ${JSON.stringify(title)}`
            + ` picker=${picker} block=${U.widgets_values[newType === 'MpiLoadImage' ? 2 : 1]}`
            + (hasLinks.length ? ` loaded->${hasLinks.length} link(s)` : '')
            + (chainNodes.length ? ` drop nodes ${chainNodes.join(',')}` : '')
            + (baked && picker === 'None' ? ` (cleared baked path)` : ''));
    }
    if (!changed) return { log, changed };

    // remove dropped nodes + links, and every trace of the links
    wf.nodes = wf.nodes.filter((n) => !dropNodes.has(n.id));
    wf.links = wf.links.filter((l) => !dropLinks.has(l[0]));
    for (const n of wf.nodes) {
        for (const i of n.inputs || []) if (dropLinks.has(i.link)) i.link = null;
        for (const o of n.outputs || []) if (Array.isArray(o.links)) o.links = o.links.filter((id) => !dropLinks.has(id));
    }
    if (wf.extra?.linkExtensions) {
        const hit = wf.extra.linkExtensions.filter((e) => dropLinks.has(e.id));
        if (hit.length) log.push(`  linkExtensions dropped: ${hit.map((e) => e.id).join(',')}`);
        wf.extra.linkExtensions = wf.extra.linkExtensions.filter((e) => !dropLinks.has(e.id));
    }
    for (const r of wf.extra?.reroutes || []) {
        if (Array.isArray(r.linkIds) && r.linkIds.some((id) => dropLinks.has(id))) {
            r.linkIds = r.linkIds.filter((id) => !dropLinks.has(id));
            log.push(`  reroute ${r.id} lost dropped links (${r.linkIds.length} left)`);
        }
    }

    // ── guards: no NEW link inconsistency (a few raw files carry old stale entries) ──
    const fresh = violations(wf).filter((v) => !baseline.has(v));
    if (fresh.length) throw new Error(`${path.basename(file)}: ${fresh.join('; ')}`);
    if (baseline.size) log.push(`  (pre-existing, untouched: ${[...baseline].join('; ')})`);
    for (const n of wf.nodes) {
        const was = before.get(n.id);
        if (was && JSON.parse(was).mode !== n.mode) throw new Error(`#${n.id} mode changed`);
        if (was && JSON.stringify(JSON.parse(was).pos) !== JSON.stringify(n.pos)) throw new Error(`#${n.id} moved`);
        if (was && !UPLOAD_OF[n.type] && !Object.values(UPLOAD_OF).includes(n.type) && was !== JSON.stringify({ pos: n.pos, size: n.size, mode: n.mode })) throw new Error(`#${n.id} pos/size changed`);
    }
    if (!ser) throw new Error(`${path.basename(file)}: cannot reproduce the file's serialisation`);
    return { log, changed, out: ser(wf) };
}

let total = 0;
for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.json')).sort()) {
    if (SKIP.has(f)) { console.log(`${f}: SKIPPED (peer file)`); continue; }
    const file = path.join(RAW, f);
    let r;
    try { r = convertFile(file); } catch (e) { console.log(`${f}: ERROR ${e.message}`); process.exitCode = 1; continue; }
    if (!r.log.length) continue;
    console.log(`${f}${r.changed ? '' : ' (no change)'}`);
    for (const line of r.log) console.log('  ' + line);
    if (r.changed) {
        total++;
        if (WRITE) fs.writeFileSync(file, r.out);
    }
}
console.log(`${total} file(s) ${WRITE ? 'written' : 'would change (dry run)'}`);
