# MPI-1199 checklist

- [x] Route logs every volume-create status + body
- [x] On a 5xx, re-list and adopt the volume that appeared (name + DC, absent before)
- [x] Unit test: 500 + volume appeared -> 200 with its id; 500 + nothing appeared -> 500
- [x] npm test green
