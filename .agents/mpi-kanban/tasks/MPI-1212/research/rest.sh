#!/usr/bin/env bash
# MPI-1212: everything left after the 04:03Z Pod loss, in order. Waits for the instance's engine
# to read `remote` (never runs on the local GPU), logs to research/rest.log.
#   bash rest.sh 53061
cd "$(dirname "$0")"
PORT=$1
until curl -s -m 10 "http://127.0.0.1:$PORT/connector/models" | grep -q '"engine": *"remote"'; do sleep 20; done
until curl -s -m 10 "http://127.0.0.1:$PORT/proxy/queue" | grep -q queue_running; do sleep 20; done
echo "pod ready $(date -u +%T)"
for g in cse1_0 cse2_0 csfi1_2 csfi2_1 cseq1_0 cseq2_0; do
  python flowbench.py run "$PORT" "$g" 111 222 || echo "FAIL $g"
done
python replay.py "$PORT" seam1 seam2
for g in seam1_0 seam2_0; do
  python flowbench.py run "$PORT" "$g" 111 222 || echo "FAIL $g"
done
python sheet.py cse1_0 cse2_0 csfi1_2 csfi2_1 cseq1_0 cseq2_0 seam1_0 seam2_0
echo "all done $(date -u +%T)"
