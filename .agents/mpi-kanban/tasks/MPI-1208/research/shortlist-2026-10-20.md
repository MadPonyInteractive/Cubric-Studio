# Agent-model shortlist, 2026-10-20 (Cosmo improvements 4)

Source: keyless `GET https://api.deepinfra.com/v1/openai/models` + `/models/list` (script in the session
scratchpad, `di-catalogue.mjs`). Filter: vision + tools + prompt cache. Sales over today: V4.1 back to
$0.20 / $0.006, GLM-5.3-Flash back to $0.15 / $0.03.

Estimate per chat = 66K input at 87% cache hit + 1,000 out (the measured profile of 0731 and V4.1 on the
55-case suite: 0731 67.9K in / 976 out, cache hit 86%; V4.1 65.4K / 548, 89%). Ling used 114K in /
1.7K out and billed 2.2x its estimate, so a chatty model can cost up to ~2x the line below.

| Model | $/1M in / cached / out | est. $/chat | 1 run (58 chats) | 3 runs (174) |
|---|---|---|---|---|
| ref: DeepSeek-V4-Flash-0731 (text, default, 52/55) | 0.06 / 0.015 / 0.18 | 0.0016 (billed 0.0016) | | |
| **XiaomiMiMo/MiMo-V2.6-Flash** | 0.14 / 0.0028 / 0.28 | 0.0016 | $0.10 | $0.29 |
| **deepseek-ai/DeepSeek-V4.1-Flash-1017** (new V4.1 snapshot) | 0.20 / 0.006 / 0.60 | 0.0027 | $0.15 | $0.46 |
| **nvidia/NVIDIA-Nemotron-3.5-Super-VL** | 0.15 / 0.020 / 0.50 | 0.0029 | $0.17 | $0.51 |
| **zai-org/GLM-5.3-Flash** | 0.15 / 0.030 / 0.50 | 0.0035 | $0.20 | $0.61 |
| Qwen/Qwen3.5-35B-A3B | 0.14 / 0.05 / 1.0 | 0.0051 | | |
| meta-models/Muse-Glimmer-30B | 0.30 / 0.04 / 1.2 | 0.0061 | | |
| MiniMaxAI/MiniMax-M3 | 0.28 / 0.056 / 1.1 | 0.0067 | | |
| ByteDance/Seed-1.8 | 0.25 / 0.05 / 2.0 | 0.0070 | | |
| Qwen/Qwen3.6-35B-A3B (31/34 old suite) | 0.10 / 0.10 / 0.95 | 0.0076 | | |
| Kimi-K2.6, Step-5-Preview | | 0.017-0.019 | | |

Shortlist = the four in bold: each within ~2x of today's default bill. Dropped: 3-12x the default per
chat with no evidence they plan better; gemma-4-26B / Mistral-Small / Llama-4-Scout have no prompt cache.

Proposed method: ONE screening run each (55 suite + 3 vision cases = 58 chats), sequential (429s), then a
3-run pass only for a model that screens at or above ~48/55. Screen total est. $0.62, ceiling ~$1.25.
