# Shared motor reference

`motor-reference.csv` is an unchanged snapshot of
`../Engine_motor/ICE/Data/ev-motor-reference.csv` taken on 2026-10-13.
The shared database remains the upstream source; the snapshot makes this
folder portable and allows its runtime to remain offline.

The four entries identify catalogue sources and continuous / peak ratings,
maximum speed, supply voltage and cooling conditions. Their maximum speed
is not a rated working speed. They therefore populate a reference table,
not an automatic motor-selection catalogue for a stationary mechanical drive.
No values in the shared source were edited.

Refresh with `node scripts/sync-motor-reference.mjs`, then run `./run.sh --check`.
