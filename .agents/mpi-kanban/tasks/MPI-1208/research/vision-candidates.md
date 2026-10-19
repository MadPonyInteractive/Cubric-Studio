# Half 1 - DeepInfra chat models with vision + tools (keyless catalogue, 2026-10-19)

Source: `GET https://api.deepinfra.com/models/list` (tags `multimodal` + `tools`) joined with
`GET /v1/openai/models` (`metadata.pricing`, $ per 1M tokens). Today's agent model,
`deepseek-ai/DeepSeek-V4-Flash-0731`: $0.06 in / $0.015 cached / $0.18 out, 33/34, ~$0.0035 a chat.

Per-chat cost scales with the input price (a chat is ~98% input, ~52K tokens over ~4.7 calls), so
"x today" is input price / $0.06. agent-test prices cached tokens as fresh: these are ceilings.

| Model | in | cached | out | ctx | ~per chat | Why it is on the list |
|---|---|---|---|---|---|---|
| inclusionAI/Ling-3.0-flash-VL | 0.06 | 0.012 | 0.18 | 131K | $0.0035 (same as today) | named in MPI-1134; same price as today |
| google/gemma-4-26B-A4B-it | 0.07 | - | 0.34 | 262K | $0.004 | cheap, featured |
| nvidia/NVIDIA-Nemotron-3.5-Super-VL | 0.10 | 0.08 | 0.40 | 262K | $0.006 | named in MPI-1134 |
| Qwen/Qwen3.6-35B-A3B | 0.10 | 0.10 | 0.95 | 262K | $0.006 | featured; Qwen3-VL-30B scored 7/22 in 2026-09 |
| XiaomiMiMo/MiMo-V2.6-Flash | 0.14 | 0.0028 | 0.28 | 1M | $0.008 ceiling, far less cached | named in MPI-1134; cheapest cache rate |
| deepseek-ai/DeepSeek-V4.1-Flash | 0.20 | 0.006 | 0.60 | 1M | $0.012 ceiling | same family as today's model, now multimodal |
| deepseek-ai/DeepSeek-V4-Flash-Vision-Exp | 0.44 | 0.014 | 1.32 | 1M | $0.026 ceiling | experimental vision arm of today's model |

Suite: 53 cases x 3 runs = 159 chats per model for a full pass.

Proposed spend (needs Fabio's yes, after the vision wiring lands, since the bench sends describer
text until then): 1 run of every case on 4 models (Ling, Nemotron-Super-VL, MiMo-V2.6-Flash,
DeepSeek-V4.1-Flash) = 212 chats, ceiling ~$1.60; then 3 runs on the best 2 = 318 chats, ceiling
~$3.40. Total ceiling about $5.
