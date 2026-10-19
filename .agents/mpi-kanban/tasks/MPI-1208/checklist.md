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
- [ ] look hands the picture to a vision-capable chat model (fallback: describer text)
- [ ] DeepInfra vision+tools candidates listed
- [ ] Bench runs priced; Fabio's yes before spending
- [ ] Recommendation with score and cost per chat
- [ ] Finding in docs/agent-findings.md
