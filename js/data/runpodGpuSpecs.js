/**
 * runpodGpuSpecs.js — what the GPU picker overlay (MpiGpuPicker, MPI-894 1c) shows and
 * filters on, beyond what RunPod's catalogue returns.
 *
 * RunPod publishes no speed figure and v2 has no per-card RAM or vCPU, so a tile shows
 * what we CAN know: the catalogue (name, VRAM, price, stock, max count) plus the spec-sheet
 * compute below. Pure module: no DOM, so node runs it (tests/gpu-picker.test.cjs).
 */

// Video filter (Fabio 2026-09-29): a card suits video with MORE than this much VRAM.
// Every model runs on less, spilling weights to RAM (footprint.js); above it the big
// video models stay mostly in VRAM, which is what makes them fast.
export const VIDEO_MIN_VRAM_GB = 24;

// Peak dense FP16 tensor TFLOPS (no sparsity) from each vendor datasheet, keyed by
// RunPod's GPU type id (docs.runpod.io/references/gpu-types, 2026-09-29). GeForce cards
// use the FP16-accumulate figure: at FP32 accumulate they run half rate, which would put
// a 4090 at half an L40S when they generate about as fast. Where a datasheet prints only
// the sparse figure it is halved; a few (3080 Ti, 4080 SUPER, B300, the RTX Ada
// workstation cards) are derived from NVIDIA's other published numbers. A spec sheet,
// not a measurement: the tile says so, and a card missing here shows no speed.
// ponytail: hand-kept table; a card RunPod adds later shows no bar until a row lands here.
export const GPU_TFLOPS = {
    'AMD Instinct MI300X OAM': 1307.4,
    'NVIDIA A100 80GB PCIe': 312,
    'NVIDIA A100-SXM4-80GB': 312,
    'NVIDIA A30': 165,
    'NVIDIA A40': 149.7,
    'NVIDIA B200': 2250,
    'NVIDIA B300 SXM6 AC': 2250,
    'NVIDIA GeForce RTX 3070': 81.3,
    'NVIDIA GeForce RTX 3080': 119.1,
    'NVIDIA GeForce RTX 3080 Ti': 136.4,
    'NVIDIA GeForce RTX 3090': 142.3,
    'NVIDIA GeForce RTX 3090 Ti': 160,
    'NVIDIA GeForce RTX 4070 Ti': 160.4,
    'NVIDIA GeForce RTX 4080': 194.9,
    'NVIDIA GeForce RTX 4080 SUPER': 208.9,
    'NVIDIA GeForce RTX 4090': 330.3,
    'NVIDIA GeForce RTX 5080': 225.1,
    'NVIDIA GeForce RTX 5090': 419,
    'NVIDIA H100 80GB HBM3': 989.5,
    'NVIDIA H100 NVL': 835.5,
    'NVIDIA H100 PCIe': 756.5,
    'NVIDIA H200': 989.5,
    'NVIDIA H200 NVL': 835.5,
    'NVIDIA L4': 121,
    'NVIDIA L40': 181.05,
    'NVIDIA L40S': 362.05,
    'NVIDIA RTX 2000 Ada Generation': 48,
    'NVIDIA RTX 4000 Ada Generation': 106.9,
    'NVIDIA RTX 4000 SFF Ada Generation': 76.8,
    'NVIDIA RTX 5000 Ada Generation': 261.1,
    'NVIDIA RTX 6000 Ada Generation': 364,
    'NVIDIA RTX A2000': 31.95,
    'NVIDIA RTX A4000': 76.7,
    'NVIDIA RTX A4500': 94.6,
    'NVIDIA RTX A5000': 111.1,
    'NVIDIA RTX A6000': 154.8,
    'NVIDIA RTX PRO 4500 Blackwell': 203,
    'NVIDIA RTX PRO 6000 Blackwell Max-Q Workstation Edition': 438.9,
    'NVIDIA RTX PRO 6000 Blackwell Server Edition MIG 1g.24gb': 125,
    'NVIDIA RTX PRO 6000 Blackwell Server Edition MIG 2g.48gb': 250,
    'NVIDIA RTX PRO 6000 Blackwell Server Edition': 500,
    'NVIDIA RTX PRO 6000 Blackwell Workstation Edition': 503.8,
    'Tesla V100-PCIE-16GB': 112,
    'Tesla V100-SXM2-16GB': 125,
    'Tesla V100-SXM2-32GB': 125,
};

/** Spec-sheet TFLOPS for a RunPod GPU id, or null when the table has no row. */
export function gpuTflops(id) {
    return Number.isFinite(GPU_TFLOPS[id]) ? GPU_TFLOPS[id] : null;
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
 * Sorted by VRAM, then price, so a tile never jumps when its stock changes.
 *
 * @param {Array<{id:string, vramGb?:number, price?:number|null, inStock?:boolean, cpu?:boolean}>} cards
 * @param {{autoRetry?:boolean, video?:boolean, selectedId?:string|null}} opts
 */
export function visibleGpuCards(cards, { autoRetry = false, video = false, selectedId = null } = {}) {
    const keep = (c) => c.cpu || c.id === selectedId
        || ((autoRetry || c.inStock) && (!video || (c.vramGb || 0) > VIDEO_MIN_VRAM_GB));
    const order = (a, b) => (b.cpu ? 1 : 0) - (a.cpu ? 1 : 0)
        || (a.vramGb || 0) - (b.vramGb || 0)
        || (a.price ?? Infinity) - (b.price ?? Infinity);
    return (cards || []).filter(keep).sort(order);
}
