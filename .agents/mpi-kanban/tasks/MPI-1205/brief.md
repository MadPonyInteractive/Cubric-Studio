# MPI-1205: a deleted project goes to the Recycle Bin, and never takes another project with it

A tester (2026-10-19) copied cards from an old, messy project into a fresh one with Add to project, then deleted the messy one. Both projects were gone.

Add to project is a real file copy, so it was not the cause. The fresh project had been created with the messy project's folder as its location, so it lived inside it; Delete removed the messy folder recursively and permanently.

Fix: create refuses a location inside a project, delete refuses a folder that holds one, and delete goes to the Recycle Bin (Fabio's ask) with no permanent-delete fallback.
