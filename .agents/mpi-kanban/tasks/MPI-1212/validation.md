# MPI-1212 validation

2026-10-20 prep (no GPU):
- `python research/flowbench.py dry` -> all 6 Klein Flow templates swap to FLUX.3 Turbo + base and pass the link/no-Klein check.
- `research/inputs.json`: 2 real past runs per Flow (Make Seamless: none on disk).

No bench run yet: waiting on the GPU-free go.

2026-10-22 Pod bench, run 1 (RTX PRO 4500, `research/flowbench.py run 53061 <graph> 111 222`;
sheets `research/sheets/<graph>.jpg`, cols today | FLUX.3 Turbo | FLUX.3 base). No LoRA active in
any captured graph, so the swap is like for like. Time per run: Klein ~13 s, Turbo ~16 s, base ~47 s.
50/60 runs success; cse1/cse2 cut off when the Pod disappeared (404 at ~04:03Z).
First read (Fabio has the final say):
- Draw It In: dii1 (squirrel) Klein wins - follows the brown drawing, fills the box; FLUX.3 draws a
  small grey squirrel. dii2 (cap) tie; base seed 111 makes the cap blue.
- Scribble: Klein wins clearly. FLUX.3 copies the doodle's flat paint (base keeps it painterly,
  Turbo bends the bed); Klein renders a real scene.
- Outpaint: FLUX.3 Turbo FAILS - leaves the black padding unpainted (pass 1 and 2, both inputs,
  both seeds). Base fills it, close to Klein. -> Klein stays; FLUX.3 base at best a tie at 4x the time.
- Character Sheet Editor (Klein slot), from Images, editor Qwen slot, Make Seamless: not run yet.
