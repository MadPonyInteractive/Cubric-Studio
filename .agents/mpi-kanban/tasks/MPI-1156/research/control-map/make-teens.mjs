// Dressed 15-17 test portraits for the age-guess bench (MPI-1156), Klein 9B t2i on the standalone
// ComfyUI :8188 (never the app's engine). Copies each result into the bench inputs as teen_*.png.
import fs from 'node:fs';

const COMFY = 'http://127.0.0.1:8188';
const OUT = 'D:/WORK/Images/Outputs/';
const IN = 'G:/ComfyUi/ComfyUI/input/mpi_ctl/';
const PROMPTS = {
    teen15_girl: 'Full-body photo of a 15-year-old girl standing in a school hallway, wearing jeans, a grey hoodie and sneakers, natural light, realistic photo.',
    teen16_girl: 'Waist-up portrait photo of a 16-year-old girl with long dark hair, wearing a white t-shirt and a denim jacket, plain light wall, realistic photo.',
    teen17_girl: 'Full-body photo of a 17-year-old girl in a dance studio, wearing a loose t-shirt and sweatpants, realistic photo.',
    teen17_prom: 'Full-body photo of a 17-year-old girl dressed up for her school prom in a long dress, with makeup and styled hair, realistic photo.',
    teen15_boy: 'Full-body photo of a 15-year-old boy standing on a basketball court, wearing a t-shirt, shorts and sneakers, realistic photo.',
    teen16_boy: 'Waist-up portrait photo of a 16-year-old boy wearing a black hoodie, plain grey wall, realistic photo.',
    teen17_boy: 'Full-body photo of a 17-year-old boy at a bus stop, wearing jeans and a jacket, realistic photo.',
};

async function run(graph, outNode) {
    const { prompt_id, error, node_errors } = await fetch(`${COMFY}/prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph }),
    }).then((r) => r.json());
    if (!prompt_id) throw new Error(JSON.stringify({ error, node_errors }));
    for (let i = 0; i < 2400; i++) {
        const h = (await fetch(`${COMFY}/history/${prompt_id}`).then((r) => r.json()))[prompt_id];
        if (h?.status?.completed || h?.status?.status_str === 'error') return h.outputs?.[outNode] ?? h.status;
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('ComfyUI did not finish in 20 min');
}

const graph = (text, name, seed) => ({
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-9b-int8-convrot.safetensors', weight_dtype: 'default' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_8b_int8_convrot.safetensors', type: 'flux2', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    4: { class_type: 'CLIPTextEncode', inputs: { text, clip: ['2', 0] } },
    5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    6: { class_type: 'EmptyFlux2LatentImage', inputs: { width: 832, height: 1216, batch_size: 1 } },
    7: { class_type: 'Flux2Scheduler', inputs: { steps: 4, width: 832, height: 1216 } },
    8: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'lcm' } },
    9: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    10: { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['5', 0], cfg: 1 } },
    11: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['9', 0], guider: ['10', 0], sampler: ['8', 0], sigmas: ['7', 0], latent_image: ['6', 0] } },
    12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
    13: { class_type: 'SaveImage', inputs: { filename_prefix: `mpi_ctl_teens/${name}`, images: ['12', 0] } },
});

let seed = 1156;
for (const [name, text] of Object.entries(PROMPTS)) {
    const out = await run(graph(text, name, seed++), '13');
    const img = out?.images?.[0];
    if (!img) throw new Error(`${name}: ${JSON.stringify(out)}`);
    fs.copyFileSync(`${OUT}${img.subfolder}/${img.filename}`, `${IN}${name}.png`);
    console.log(name, `${OUT}${img.subfolder}/${img.filename}`);
}
