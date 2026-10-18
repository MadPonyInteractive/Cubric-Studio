# MPI-1173 validation

- Bench (`research/`): ComfyUI Qwen3-VL 4B describer on the standalone :8188, 16 pictures x 3. Doodles YES 15/15; children (photo, painted, traced line art, a photo with strokes over it) and adults NO 33/33. `research/results.txt`.
- `npm test`: 3400 pass, 0 fail. New gate test: a doodle YES queues, NO or chatter refuses, a doodle never clears words naming a child.
- Shipped in 59ca111a0.
- Live (Fabio, 2026-10-18): his doodle uploaded as the Drawing with the lingerie prompt went through. app.log 07:29:58 `YES to "Does this picture show a person..."`, then 07:29:59 `a rough doodle: no age in it, the words decide`.
