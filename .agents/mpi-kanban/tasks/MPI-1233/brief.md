# MPI-1233 - Cosmo compacts at a share of the model's window again: 20% on 1M, 50% below

Fabio, 2026-10-21: Cosmo offered "start fresh / compact" 15 messages into a $0.02 chat on
MiMo-V2.6-Flash (1M window). MPI-1125 (2026-10-13) fixed compaction at 128k (card at 64k),
judged on DeepSeek-V4-Flash's cached rate ($0.015/1M). MiMo's is $0.0028/1M, so the cost
argument mostly went. Decided: compact at 20% of a window >= 1M, 50% of a smaller one, no
fixed cap; the long-chat card stays at half the compaction point.

On a 1,048,576 window: compaction ~210k, card ~105k. 256k: 128k / 64k. 128k: 64k / 32k.
