#!/bin/bash
# Full Connect-to-Kiorex browser walk on fresh STANDALONE orgs (DEV ONLY). Usage: walk/run-all.sh <tag>
set -u; cd "$(dirname "$0")"; TAG=${1:-w3}; E2E=..
step() { echo "=== $*"; "$@" 2>&1 | cut -c1-400; }
(cd $E2E && npx tsx walk/setup.ts $TAG >/dev/null 2>&1 && ONLY_CLINIC_C=1 npx tsx walk/setup.ts $TAG 2>&1 | tail -1)
rm -f .auth-clinic*.json
(cd $E2E && npx tsx walk/gate.ts release kiorex.pharmacy_orders; npx tsx walk/gate.ts release kiorex.lab_bookings) 2>&1 | tail -2
rm -f codes.json
KINDS=PHARMACY,LAB,CLINIC step node ops1.mjs
step node clinic1.mjs
step node clinic2.mjs
step node clinic3.mjs
step node product1.mjs
step node product2.mjs
step node ops2.mjs
for k in pharmacy lab; do step node ops3.mjs $k; done
(cd $E2E && npx tsx walk/gate.ts record kiorex.pharmacy_orders && npx tsx walk/gate.ts record kiorex.lab_bookings) 2>&1 | tail -2
for k in pharmacy lab clinic; do step node ops4.mjs $k; done
for k in pharmacy lab; do step node product3.mjs $k; done
step node clinic4.mjs
step node flows5.mjs
(cd $E2E && npx tsx walk/gate.ts release kiorex.pharmacy_orders; npx tsx walk/gate.ts release kiorex.lab_bookings) 2>&1 | tail -2
(cd $E2E && npx tsx walk/msgs.ts) 2>&1 | tail -20
echo ALL-DONE
