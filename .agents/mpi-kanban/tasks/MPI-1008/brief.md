# MPI-1008 Brief

DramaBox can fail its text encode with a device mismatch when VRAM is tight. Breaks users: the
paid DramaBox Flow (Gumroad) fails on a 16 GB card.

## Seen (2026-10-01, Fabio's RTX 4060 Ti 16 GB, found during MPI-1004's live look)

`%APPDATA%\Cubric Studio\logs\app.log`, 08:06:26-08:06:51Z, the first DramaBox run after an
engine start (engine up 08:05:38):

```
[DramaBox] Gemma 4-bit loaded. 15.98 / 16.00 GB used on cuda:0
Requested to load EmbeddingsProcessor
0 models unloaded.
loaded completely; 0.00 MB usable, 0.00 MB loaded, full load: False
!!! Exception during processing !!! Expected all tensors to be on the same device, but got
mat1 is on cuda:0, different from other tensors on cpu (when checking argument in method
wrapper_CUDA_addmm)
  generate.py:55 encode -> text_encoder.py:216 ep.process_hidden_states
  -> feature_extractor.py:140 audio_aggregate_embed -> F.linear
```

The agent's automatic retry 28 s later ran clean (`loaded completely; 6222.65 MB usable,
1504.35 MB loaded, full load: True`). So it is intermittent and depends on what else holds VRAM;
after the good run freed the encoder, 9.92 GB was still in use, cause not identified (Windows
`nvidia-smi` hides per-process use).

## Root cause (read, not yet proven by a fix)

`ComfyUI-MelodramaBox/dramabox_nodes/model/text_encoder.py` (our fork,
`MadPonyInteractive/ComfyUI-MelodramaBox`, pinned `9ebb44be` in `dev_configs/node_lock.json`):

- `_build_gemma_4bit` calls `mm.free_memory(9 GB)` and then has transformers load the bnb-4bit
  Gemma straight to `cuda` (`device_map`), OUTSIDE ComfyUI's model management (bnb models cannot
  be moved, so it is not a ModelPatcher).
- `encode` then calls `patching.load_patchers([self._ep_patcher])`. ComfyUI does not count
  Gemma, sees no free VRAM, and partial-loads the embeddings processor with 0 MB on the GPU.
- The processor is vendor `mdb_ltx_core` code with plain `torch.nn.Linear`, not `comfy.ops`
  cast layers, so a partial load does NOT cast weights on the fly: `hidden_states` (cuda) meets
  the weights (cpu) and `F.linear` raises.

## Fix direction (decide at pickup)

- In `encode`, run the processor where its weights actually are, or force it fully onto the
  GPU (`force_full_load`) after making room. A short prompt through a ~1.5 GB processor on the
  CPU is slow but correct; a forced load can still OOM if the room is not there.
- Better: make ComfyUI aware of the 4-bit Gemma's VRAM so its free-memory sums are true.
- Reproduce first: fill VRAM before a DramaBox run (or lower the free-memory target) and watch
  for `0.00 MB usable ... full load: False`.
- Ships as: commit + push the fork, repin `node_lock.json` (`/mpi-nodes-sync`), the bump-engine
  smoke for drama-box.

## Noticed
