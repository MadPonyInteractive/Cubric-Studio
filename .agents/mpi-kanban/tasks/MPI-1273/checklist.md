# MPI-1273 checklist

- [x] `refusal('pictureUnchecked', error)` carries the describer's error in its message
- [x] `_pictureVerdicts` keeps the first describer error (and a clip frame that could not be read)
- [x] `_refuseChildSafety` logs the error
- [x] Tests: the message names the error; no error = the old message
- [x] `docs/child-safety.md` says the refusal names what broke
