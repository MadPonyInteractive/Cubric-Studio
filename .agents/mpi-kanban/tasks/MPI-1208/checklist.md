# MPI-1208 checklist

## Half 2 - tool facts (no recipes)
- [x] Edit ops note: keeps first picture's shape, changes content/pose/clothes, later pictures are sources
- [x] i2i note: keeps pose and layout at a denoise that keeps the person
- [x] crop note: changes the shape only
- [x] Outpaint `does`: changes the shape, fills the new area from its prompt
- [x] OP_RULES `shape` reworded so it cannot read as "i2i changes shape"
- [x] One planning line in the system prompt (budget raised by its cost only)
- [x] Qwen-Image 2.1 edit note says why it is rank 1 before the licence line
- [x] Bench case for the 9:16 job (crop or outpaint before an edit, no i2i)
- [x] Tests green: model-priority, agent-prompt-budget, agent-loop, agent-tiles, agent-bench

## Half 1 - vision agent model
- [x] look hands the picture to a vision-capable chat model (fallback: describer text)
- [x] DeepInfra vision+tools candidates listed
- [x] Bench runs priced; Fabio's yes before spending
- [ ] Recommendation with score and cost per chat
- [ ] Finding in docs/agent-findings.md
- [x] Custom size on edit (MPI-1207): EDIT_NOTE says a ratio re-composes the frame; shape-then-edit accepts one edit at a new ratio (2026-10-20)
- [x] Bench: Ling step 1 rerun, DeepSeek-V4.1 3-run pass, finding in docs/agent-findings.md (2026-10-20)
- [x] Resolution: max = the model's last tier, image + video bench cases (2026-10-20)
