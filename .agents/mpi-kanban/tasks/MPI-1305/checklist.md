# MPI-1305 checklist

- [ ] The planner's answer lands as Markdown (Cast / Places / Objects / Panel N headings)
- [ ] The parser reads the Markdown and the old bracket form alike (hand-written, MCP, saved plans)
- [ ] The plan box is a "View plan" button, disabled until a plan exists, opening the notes Markdown viewer/editor; Save writes the plan back
- [ ] The idea box takes the freed height
- [ ] Tests for the conversion and the parse round trip; lint + npm test green
- [ ] Seen in an isolated instance; screenshot for Fabio
