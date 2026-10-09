# Source Manifest — Qwen-Image 2.1

Provenance for the `qwen-image-2.1` recipe (MPI-1048). **Vendor-skill sourced** (playbook 08):
Qwen published the system prompts of its own prompt rewriters, which are the closest thing to a
specification this model has. No NotebookLM notebook exists for Qwen-Image 2.1; not a blocker.

- **Model version researched:** Qwen-Image 2.1 (Alibaba, released 2026-09-20), the 7B unified
  t2i + edit model Vision ships as `qwen-image-2-1` (int8 convrot transformer, stock
  Qwen3-VL-8B encoder, RGBA VAE). NOT Qwen-Image 2512 / Edit 2509 / Edit 2511, which are a
  different 20B model: community findings measured on those are marked and not adopted.
- **Research date:** 2026-10-09 (clock checked against `gh api rate_limit -i` →
  `Fri, 09 Oct 2026 07:27:14 GMT`; no skew).
- **Researcher:** agent (vendor repo via `gh api`, ComfyUI source on the local bench, web search,
  Vision's own MPI-936 bench).

## Sources

| # | Title / URL | Authority tier | Accessed | Notes |
|---|---|---|---|---|
| 1 | https://github.com/QwenLM/Qwen-Image-2.1 — `prompt_rewrite/prompts/system_prompt_t2i.txt` | official-docs | 2026-10-09 | **The primary source.** System prompt of `Qwen/Qwen-Image-2.1-PE-T2I`, the official t2i rewriter (a fine-tuned Qwen3.5-VL 9B). Byte-identical to the `system_prompt.txt` shipped in the HF checkpoint (diffed). Eight steps: split fixed vs open, fix the frame (ratio in a separate field, never in the prose), ~20-word opening sentence naming the medium, inventory with 8-14 positional phrases, walk the frame, quote every string, a lighting sentence, one closing composition sentence. **~20 sentences, 400-500 words, the same size for a 3-word or a 300-word brief.** Observer register, no quality boosters. |
| 2 | same repo — `prompt_rewrite/prompts/system_prompt_edit.txt` | official-docs | 2026-10-09 | System prompt of `Qwen/Qwen-Image-2.1-PE-I2I` (identical to the HF copy after CRLF). Edit = an INSTRUCTION, led by the operation; attribute disentanglement (edit the named attribute at full strength, hold the rest at input fidelity); preserve by type/position/role without re-describing; `<image1>`, `<image2>` tags mandatory for 2+ images, none for one; quoted text literal and monolingual; ratio never in the prose. **Feeds the agent guide only**: Enhance never runs on edit ops (`ENHANCE_EXEMPT_OPS`). |
| 3 | https://github.com/QwenLM/Qwen-Image-2.1 — `README.md` (+ `prompt_rewrite/README.md`) | official-docs | 2026-10-09 | Recommends the rewriters "for best results"; the rewriters are trained on these prompts and the stock Qwen3.5 base "does not reliably emit the answer JSON". **RGBA template:** "This is an RGBA image with transparency. <description>. The image has alpha channel and the background is transparent." Short official examples (neon sign with a quoted string; "Change the background to a sunset beach"). Encoder: Qwen3-VL 8B. Negative field always empty in the rewriter output. |
| 4 | ComfyUI core `comfy/text_encoders/qwen_image21.py` + `comfy_extras/nodes_qwen.py` (`TextEncodeQwenImage21`), engine 0.39 on the G: bench | official-docs (code-derived) | 2026-10-09 | The encoder's own template is ONE line, system turn `Comprehend and analyze the provided prompt.`, then the user text raw; the system turn is dropped from the conditioning. Each reference image is prefixed `<image1>`, `<image2>`... before the prompt text. No prompt-side token cap (Qwen3-VL long context). So the rewriter prompts are NOT part of the encoder; nothing rewrites a prompt between the box and the model. |
| 5 | https://github.com/iamyoki/qwen-image-2.1-skill (154★, Apache-2.0) | community-skill | 2026-10-09 | Phase 0 step 2, top-starred prompting skill. A faithful restatement of #1 and #2 (same 8 steps, same 400-500 words, same `<image1>` rule) plus a vocabulary cheat sheet. **Adopted nothing new**; confirms the reading. **Rejected** its JSON / `wh_ratio` output contract: in Vision the Prompt Box ratio picker owns the canvas. |
| 6 | https://github.com/kjranyone/qwen-image-2.1-prompt-guide (5★, MIT; supplied by Fabio) | community-skill | 2026-10-09 | Built the day after release. Restates #1-#3, then community notes mostly from **Qwen-Image 2512 / Edit 2509** (a different 20B model). **Rejected:** "1-3 sentences / 31 words is optimal" (measured on 2512, contradicts #1 for 2.1); CFG 6-8 for text and negative prompts for hands (Vision runs cfg 1, negative is inert). **Kept as hypothesis only:** a closing "No other text appears in the image." to stop stray lettering (unmeasured on 2.1, not in the draft). |
| 7 | `docs/models/qwen-image-2/README.md` + `.agents/mpi-kanban/tasks/MPI-936/research/` (bench run 3) | **in-house measurement** | 2026-10-09 | Shipped config euler/simple, 25 steps, **cfg 1, so the negative does nothing** (`negativePrompt: false`). Transparency is asked for in the prompt and survives only on `t2i` and `edit`; every other op drops alpha. Short bench prompts ("dress the woman in image 1 in the jacket from image 2") rendered correctly, so short prompts WORK; whether the vendor's long form renders better at 25 steps int8 is a Stage 2 question. |
| 8 | https://comfyui-wiki.com/en/news/2026-09-22-qwen-image-2-1-prompt-enhancer | community-deep-dive | 2026-10-09 | Confirms ComfyUI's official 2.1 templates never call the rewriter, and that a community node pack (`benjiyaya/ComfyUI-Qwen-Image-2.1-Prompt-Enhancer`, 182★) exists to run it. So a ComfyUI user typing a short prompt gets what Vision users got before this recipe: no rewrite. |

## Conflicts

1. **Length.** #1 and #5: one paragraph, ~20 sentences, 400-500 words, regardless of brief.
   #6 (2512, other model): 1-3 sentences. #7: short prompts render fine on our bench. The
   harness's `overlong` tier is 410 words and its `condensed` check requires the output to be
   shorter. Draft: the vendor's STRUCTURE at a tighter length, 250-350 stated, 200-400 checked;
   Stage 2 compares it against a full 450-word rewrite.
2. **Orientation word in the opening sentence.** #1 names it ("a vertical ... photograph")
   because the rewriter also picks the ratio. Vision's enhancer never sees the ratio picker, so a
   named orientation can contradict the canvas. Draft: name it only when the user did.
3. **Reference naming.** #2 and #4 say `<image1>`; Vision's MPI-936 bench and the shared guide
   used "image 1" and it landed. Not a recipe question (Enhance skips edit); the guide teaches
   `<image1>` from #2/#4 and Stage 2 confirms on a render.
