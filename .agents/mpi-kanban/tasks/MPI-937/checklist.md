# MPI-937 Checklist

- [x] cloudExecutor: a failure after a Stop settles cancelled (warn log), never the error dialog
- [x] gallery: the card a Stop kept cooking walks off (cancelled clip) when the paid result fails instead
- [x] unit: Stop once sent + provider 500 = no ui:error, job CANCELLED (fails with the fix off)
- [x] desktop spec case 5b: cooking card + generation:error plays cancelled, then goes (fails with the fix off)
