# MPI-1235 - Long-chat card: 75% of the compaction point under 1M, no cost line on local

Fabio, 2026-10-21, screenshot: on Ornith 9B (local Ollama) the long-chat card showed after
the first question. Ollama's agent window is our fixed `OLLAMA_AGENT_CONTEXT` 65,536, so it
compacts at 32,768 and the card (half of that, MPI-1125) fired at 16,384: the ~8k fixed floor
plus a list_models result plus history carried over from a MiMo turn. Its title also said
"cost a little more", false on a local model.

Decided: on windows under 1M the card shows at 75% of the compaction point (64k -> ~24.6k);
1M+ keeps half (MPI-1233). On local Ollama the title says slower only.
