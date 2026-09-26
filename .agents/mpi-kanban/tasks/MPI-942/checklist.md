# MPI-942 checklist

Measured on an isolated instance at 1920x1032: agent panel top 84px, gallery scroll box top 90px
(`.tool-container` pads 58px, the topbar is 52px), plus the grid's own 16px top padding = 22px.

- [x] Gallery's tool-container pads 52px (the topbar), not 58px
- [x] Grid drops its 16px top padding outside focus mode; focus mode keeps it
- [x] Measured: first row top == agent panel top at rest, and scroll clip == agent panel top
