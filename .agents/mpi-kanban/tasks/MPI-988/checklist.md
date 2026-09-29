# MPI-988 checklist

- [x] `modelShowsRatio` also requires the op's own components to list `ratio` (the UI's gate), so the agent path stops injecting Width/Height on inpaint, Klein detail/upscale, Boogu and cloud edit, pid
- [x] Test: klein-9b inpaint resolves with no Width/Height and refuses a ratio; t2i and klein-9b i2i still take one
- [x] Existing ratio / named-param / agent tests green
- [ ] Live (after an app reload): a masked agent inpaint on a 1920x1080 picture comes back at the source size
