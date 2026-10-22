# MPI-1255 Checklist

- [x] Mascot freeze / would-not-play / moving-again lines and their frame heartbeat run only under `speed_diagnostics`
- [x] Band false alarm: a connecting scene overtaken by `crew` before its first frame no longer reads as frozen; both band clips pause
- [x] ResizeObserver loop: root cause found (Flow host shrink-wrapped its step) and fixed at the host
- [x] Lint + unit tests green
