# MPI-1221 validation

- Cause, from app.log 2026-10-21 01:06/01:07: seedance-2-cloud answered HTTP 500 (provider ark.ap-southeast.bytepluses.com said 400) -> coded PROVIDER_ERROR -> error dialog.
- `_codeForStatus` now reads a wrapped 4xx naming "sensitive" as CONTENT_FILTERED (BytePlus SensitiveContentDetected codes); the route log carries the provider code.
- cloudExecutor: CONTENT_FILTERED emits ui:warning (toast), not ui:error.
- node --test tests/deepinfra-multiref.test.cjs tests/cloud-executor.test.cjs: 41 pass, 0 fail.
- Not live-checked: no Seedance 2 refusal reproduced (it needs a real-person image on the paid route); the classifier string is taken from BytePlus error naming, and the new log line will show the real code on the next refusal.
