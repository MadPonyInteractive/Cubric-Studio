# MPI-1142 brief

## Noticed

- 2026-10-16: at app boot, /list-projects, /comfy/models/check, /engine/deps-status and /system/gpu-info each stay open ~4 s together, so the landing's mascot clips queue ~4 s behind them (app.log 08:04:57Z). Boot-only; not the download stall.
- 2026-10-16: remote uninstall answers only after every wrapper delete (191 s on a busy Pod), holding one browser socket the whole time. Could answer at once and report through `download:uninstalled`, which it already broadcasts.
- 2026-10-16: Krea 2 NSFW Install was refused "need 15.9 GB, have 14.1 GB" at 08:07:55Z, then 8 s later ran needing only 4 LoRAs + nodes (18 on the volume). The first quote counted files already on the volume, likely the volume check right after connect. Unexplained.
