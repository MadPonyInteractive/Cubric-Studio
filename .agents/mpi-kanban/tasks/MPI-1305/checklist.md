# MPI-1305 checklist

- [ ] The planner's answer lands as Markdown (Cast / Places / Objects / Panel N headings)
- [ ] The parser reads the Markdown and the old bracket form alike (hand-written, MCP, saved plans)
- [ ] The plan box is a "View plan" button, disabled until a plan exists, opening the notes Markdown viewer/editor; Save writes the plan back
- [ ] The idea box takes the freed height
- [ ] Tests for the conversion and the parse round trip; lint + npm test green
- [ ] Seen in an isolated instance; screenshot for Fabio

## Follow-up: per-panel references (2026-10-27, ships in 2.1.3)

- [x] A panel gets only the pictures of what it names: user pictures by note/plan line, drawn ones by mention, renumbered per panel; an unowned picture rides every panel
- [x] A pictured cast member gets no description in that panel ("Rusty is the character from image 2")
- [x] Tests first (2 new failing, then green) + existing expectations updated; storyboard.md updated
- [ ] A real panel run on FLUX.3 Klein (GPU, waits on Fabio)
