# MPI-1297 checklist

- [x] Depth / Canny / Scribble: the input photo is looked at like any picture (age question, doodle, age guess 20+)
- [x] Pose unchanged: never looked at, the words decide
- [x] The map look (`controlMapOf`, `controlMapDescribe` op + workflow) removed
- [x] Tests updated both ways: adult photo passes, child photo refuses
- [x] docs/child-safety.md updated
- [x] lint + tests green
