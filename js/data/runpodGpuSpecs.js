/**
 * runpodGpuSpecs.js — what the GPU picker overlay (MpiGpuPicker, MPI-894 1c) shows and
 * filters on, beyond what RunPod's catalogue returns.
 *
 * Neither RunPod API carries a speed figure (v2's GpuType has none; GraphQL's `throughput`
 * is null on every card) and v2 has no per-card RAM or vCPU, so a tile shows the catalogue
 * (name, VRAM, price, stock, max count) plus RunPod's own measured generation times below.
 * Pure module: no DOM, so node runs it (tests/gpu-picker.test.cjs).
 */

// Video filter (Fabio 2026-09-29): a card suits video with MORE than this much VRAM.
// Every model runs on less, spilling weights to RAM (footprint.js); above it the big
// video models stay mostly in VRAM, which is what makes them fast.
export const VIDEO_MIN_VRAM_GB = 24;

// Measured seconds per image, FLUX.2 Klein 9B bf16 (official 4-step template), ComfyUI,
// single user, median of repeat runs on RunPod Secure Cloud Pods, Jul 3 - Sep 10 2026:
// runpod.io/articles/guides/best-gpu-for-comfyui. Keyed by RunPod's GPU type id.
// Klein stands in for Krea2, which RunPod does not benchmark: a similar-size Flux-lineage
// model that, like our fp8 Krea2, fits 24 GB, so it ranks cards the way Krea2 should. Only
// the RANKING carries over; Krea2 runs more steps, so these are not Krea2's seconds.
// Spec-sheet TFLOPS was here until MPI-1007 and misranked cards (an H100 SXM at 990 lost
// SDXL to a 5090 at 419). A video bar waits on RunPod's LTX-2.3 numbers.
// Rows marked `ours` are cards RunPod skipped, measured by us (MPI-1054, 2026-10-09) with
// their setup replicated: same graph, ComfyUI v0.39.0, a new prompt every image. Checked on
// two cards they did measure: A40 4.6 s vs their 4.80, A5000 6.75 s vs their 6.46.
// ponytail: hand-copied table; a card nobody benchmarked shows no bar.
export const GPU_GEN_SECS = {
    'NVIDIA H100 80GB HBM3': 1.47,
    'NVIDIA RTX PRO 6000 Blackwell Server Edition': 1.51,
    'NVIDIA B300 SXM6 AC': 1.58,
    'NVIDIA GeForce RTX 5090': 2.28,
    'NVIDIA RTX PRO 6000 Blackwell Server Edition MIG 2g.48gb': 3.18,
    'NVIDIA A100-SXM4-80GB': 3.27,
    'NVIDIA L40S': 3.31,
    'NVIDIA RTX PRO 4500 Blackwell': 3.40,
    'NVIDIA GeForce RTX 4090': 3.79,
    'NVIDIA RTX 6000 Ada Generation': 3.88,     // ours
    'NVIDIA RTX A6000': 4.53,                   // ours
    'NVIDIA A40': 4.80,
    'NVIDIA RTX PRO 4000 Blackwell': 5.04,
    'NVIDIA RTX A5000': 6.46,
    'NVIDIA RTX 4000 Ada Generation': 6.74,     // ours
    'NVIDIA GeForce RTX 3090': 6.81,
    'NVIDIA RTX A4500': 7.01,                   // ours
    'NVIDIA RTX PRO 6000 Blackwell Server Edition MIG 1g.24gb': 8.14,
    'NVIDIA L4': 8.29,                          // ours
    'NVIDIA RTX A4000': 9.42,
    'NVIDIA RTX 2000 Ada Generation': 13.19,
};

/** Measured seconds per image for a RunPod GPU id, or null when RunPod did not benchmark it. */
export function gpuGenSecs(id) {
    return Number.isFinite(GPU_GEN_SECS[id]) ? GPU_GEN_SECS[id] : null;
}

const STOCK_BARS = { High: 3, Medium: 2, Low: 1 };

/**
 * Every Secure Cloud card in RunPod's catalogue, stamped with its stock in one data
 * center (`dcId`), or the best stock across every DC when `dcId` is null (Any region,
 * MPI-78). The overlay's Auto-retry switch then filters: on = all, off = in stock.
 *
 * Deliberately NOT the DC's own card list: RunPod leaves a card out of it while it is
 * sold out there, so EU-RO-1 read as two cards and the 5090 rented there the day before
 * could not even be picked to wait for (Fabio 2026-09-29).
 *
 * @param {{gpuTypes?:Array, dataCenters?:Array}} availability - GET /runpod/gpu-availability
 * @param {string|null} dcId
 */
export function catalogueCards(availability, dcId = null) {
    const dcs = availability?.dataCenters || [];
    const scope = dcId ? dcs.filter(d => d.id === dcId) : dcs;
    if (dcId && !scope.length) return [];
    const stock = new Map();
    for (const d of scope) {
        for (const g of (d.gpuAvailability || [])) {
            if (!g.available) continue;
            const cur = stock.get(g.gpuTypeId);
            if (!cur || (STOCK_BARS[g.stockStatus] || 0) > (STOCK_BARS[cur] || 0)) stock.set(g.gpuTypeId, g.stockStatus);
        }
    }
    return (availability?.gpuTypes || []).filter(g => g.secureCloud).map(g => ({
        id: g.id,
        name: g.displayName || g.id,
        vramGb: g.memoryInGb,
        price: typeof g.securePrice === 'number' ? g.securePrice : null,
        stock: stock.get(g.id) || null,
        inStock: stock.has(g.id),
        maxCount: g.maxCount || null,
    }));
}

/** Availability meter level 0-3 (RunPod's three bars). Out of stock = 0. */
export function stockBars(card) {
    return card?.inStock ? (STOCK_BARS[card.stock] || 0) : 0;
}

/**
 * The tiles the overlay shows, in order. The download-only CPU card leads and is never
 * filtered; the SELECTED card always shows (MPI-180: a Pod may be running on it even
 * when its stock just flipped). Everything else needs stock unless auto-retry is on
 * (then Connect waits for it, MPI-110), and more than VIDEO_MIN_VRAM_GB with Video on.
 * Sorted fastest first by measured Gen speed (Fabio 2026-10-01), unbenchmarked cards after,
 * then by VRAM, then price. Nothing here reads stock, so a tile never jumps when it changes.
 *
 * @param {Array<{id:string, vramGb?:number, price?:number|null, inStock?:boolean, cpu?:boolean}>} cards
 * @param {{autoRetry?:boolean, video?:boolean, selectedId?:string|null}} opts
 */
export function visibleGpuCards(cards, { autoRetry = false, video = false, selectedId = null } = {}) {
    const keep = (c) => c.cpu || c.id === selectedId
        || ((autoRetry || c.inStock) && (!video || (c.vramGb || 0) > VIDEO_MIN_VRAM_GB));
    const secs = (c) => gpuGenSecs(c.id) ?? 1e9;   // not benchmarked: after every measured card
    const order = (a, b) => (b.cpu ? 1 : 0) - (a.cpu ? 1 : 0)
        || secs(a) - secs(b)
        || (a.vramGb || 0) - (b.vramGb || 0)
        || (a.price ?? Infinity) - (b.price ?? Infinity);
    return (cards || []).filter(keep).sort(order);
}
