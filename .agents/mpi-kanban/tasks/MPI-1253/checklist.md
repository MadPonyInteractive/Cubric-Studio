# MPI-1253 Checklist

- [x] Box name tag above each box, inside only at the frame top (850a93d82)
- [x] Darken slider remembered across opens (850a93d82)
- [ ] ACCEPTANCE (Fabio, 2026-10-23): after Create boxes, pressing Cue (MOSS and FLUX.3 t2i) makes a picture laid out like the source cover. Test on Bazaar, Tokyo, Vogue in BoxesTest3.
- [x] Prompt after Create boxes on a 2nd picture: Tokyo/Vogue screenshots still show Bazaar's box tags in the prompt; check the caption really replaces the last auto caption (else Cue cites boxes that do not exist).
- [ ] Zoom pass (small unsnapped boxes re-asked on an enlarged crop): built + unit-tested; judge on Bazaar/Tokyo/Vogue in Fabio's app after a full restart.
