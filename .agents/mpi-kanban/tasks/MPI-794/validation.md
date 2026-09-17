# MPI-794 validation

## Real `main.js`, acceleration OFF (desktop smoke spec, `CUBRIC_E2E`)

`electron-smoke.spec.js` passed; its `app.log` holds:

```
[INFO] [gpu] startup: canvas=unavailable_software compositing=disabled_software raster=disabled_software renderer="ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11-10.0.26100.9278)" active="ANGLE (Microsoft, Microsoft Basic Render Driver ...) 10.0.26100.9278" adapters="ANGLE (Microsoft, Microsoft Basic Render Driver ...)"
```

## Real `main.js`, acceleration ON

`electron .` with a fresh `CUBRIC_USER_DATA_ROOT`, an empty `CUBRIC_ENGINE_ROOT`, its own
`CUBRIC_PORT`, no `CUBRIC_E2E`, window parked off-screen; killed by root PID after the line
appeared (no listener left on its port; the six `electron.exe` still running afterwards all
carry the user's own `--user-data-dir`):

```
[INFO] [gpu] startup: canvas=enabled compositing=enabled raster=enabled renderer="ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Ti (0x00002803) Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.16.1088)" active="NVIDIA GeForce RTX 4060 Ti 32.0.16.1088" adapters="NVIDIA GeForce RTX 4060 Ti | Intel(R) UHD Graphics 770 | Microsoft Basic Render Driver"
```

## GPU process loss

Same handler shape in a scratch Electron app, GPU process killed with `chrome://gpucrash`:

```
+287ms  STATUS startup: canvas=enabled active=NVIDIA GeForce RTX 4060 Ti
+1500ms GONE {"type":"GPU","reason":"crashed","exitCode":-1073741819,"serviceName":"GPU"}
+1724ms STATUS after GPU process loss: canvas=enabled active=NVIDIA GeForce RTX 4060 Ti
```

So `gpu-info-update` does fire again after a relaunch, and the second line lands.

## Checks

- `node --check main.js`, `eslint main.js`: clean.

## Not verified

The tester's box. That is the point of the line: the next hand-delivered build answers it.
