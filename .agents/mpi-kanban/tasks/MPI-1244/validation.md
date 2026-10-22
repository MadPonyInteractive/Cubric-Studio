# MPI-1244 validation - REJECTED, never built

No code was written. The crawl that triggered the card had a cause outside the app.

## Evidence (2026-10-22)
- The slow "Chroma Hyper" row was the model's aggregate. Its R2 weight had already finished at full size;
  the dep still moving was `controlnet-union-flux` from huggingface.co (no R2 mirror by licence).
- R2 Range reads of the same object at 0, 8.2 GB and 9 GB ran at 32-43 MB/s on fresh connections.
- Fabio found a peer agent uploading to R2 from this machine at the time. A saturated uplink slows every
  download on the line.
- Once the upload finished: Stable Audio 3 (3 R2 files) ran at 42 MB/s with three streams and 22-26 MB/s on
  its single 9.22 GB file (one fresh R2 connection measured 30 MB/s). Wan 2.2 Smooth (35.6 GB) held about
  45 MB/s start to finish, and LTX 2.3 held its speed overnight. Fabio's verdict: the upload was the fault.

## Left behind
- `brief.md` keeps the June prior art (`02ef2c0` / `a780e0a` / MPI-258) and the safe design shape, should a
  real slow-but-alive R2 stream ever be measured with the line otherwise idle.
- Open UI idea, not carded: name the active file and its host in the model row, so a Hugging Face dep
  crawling under a model's name is not read as that model's R2 weight.
