// The shipped parseStoryboardPlan over the Phase 0 v2 plans: must equal the bench's drawn prompts.
import fs from 'node:fs';
import { parseStoryboardPlan } from 'file:///C:/AI/Mpi/Cubric-Vision/js/services/storyboardRunner.js';

for (const id of ['tikori', 'diner', 'kite']) {
  const p = JSON.parse(fs.readFileSync(new URL(`./out_v2/${id}/plan.json`, import.meta.url), 'utf8'));
  const got = parseStoryboardPlan(p.text, p.idea);
  const same = got.length === p.panels.length && got.every((g, i) => g.prompt.toLowerCase() === p.panels[i].prompt.toLowerCase() && g.intent === p.panels[i].intent);
  console.log(id, got.length, same ? 'SAME as drawn' : 'DIFFERS');
  if (!same) got.forEach((g, i) => g.prompt !== p.panels[i].prompt && console.log(' ', i + 1, '\n   got :', g.prompt.slice(-260), '\n   bench:', p.panels[i].prompt.slice(-260)));
}
