#!/usr/bin/env bash
set -euo pipefail

API="http://127.0.0.1:8003"
COOKIE_JAR="$(mktemp)"
BUILDING_PAYLOAD='{
  "name": "Demo Phase 2 Cowork",
  "address": {
    "street": "47 avenue Leclerc",
    "postalCode": "69003",
    "city": "Lyon",
    "country": "France"
  },
  "floors": [{"name": "RDC"}, {"name": "1er"}],
  "status": "active",
  "accessibilityHours": [
    {"day":"monday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"tuesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"wednesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"thursday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"friday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"saturday","is24h":false,"openTime":"08:00","closeTime":"13:00"},
    {"day":"sunday","is24h":false,"openTime":"00:00","closeTime":"00:00"}
  ],
  "receptionHours": [
    {"day":"monday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"tuesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"wednesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"thursday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"friday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
    {"day":"saturday","is24h":false,"openTime":"08:00","closeTime":"13:00"},
    {"day":"sunday","is24h":false,"openTime":"00:00","closeTime":"00:00"}
  ],
  "concierge": {"link": "", "accessCode": ""}
}'

echo "=== 1) POST /buildings without session → expect 401 ==="
curl -sS -o /tmp/demo-noauth.json -w "HTTP %{http_code}\n" \
  -X POST "$API/buildings" \
  -H "Content-Type: application/json" \
  -d "$BUILDING_PAYLOAD"
cat /tmp/demo-noauth.json
echo

echo "=== 2) Session with spaces permission → create building ==="
TOKEN=$(cd /root/coworkprysme_v2/apps/gestion/Backend && node scripts/demo-session.mjs)
curl -sS -c "$COOKIE_JAR" -b "gestion_sid=$TOKEN" \
  -X POST "$API/buildings" \
  -H "Content-Type: application/json" \
  -d "$BUILDING_PAYLOAD" \
  -o /tmp/demo-create.json -w "HTTP %{http_code}\n"
cat /tmp/demo-create.json | head -c 500
echo

BUILDING_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-create.json','utf8')).id)")

echo "=== 3) GET /buildings/:id → postalCode mapping ==="
curl -sS -b "gestion_sid=$TOKEN" "$API/buildings/$BUILDING_ID" | node -e "
const data=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('postalCode:', data.address.postalCode);
console.log('coordinates:', data.coordinates);
"

echo "=== 4) GET /buildings list ==="
curl -sS -b "gestion_sid=$TOKEN" "$API/buildings" | node -e "
const data=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('count:', data.buildings.length, 'names:', data.buildings.map(b=>b.name));
"

echo "=== 5) MongoDB cowork_bdd.buildings document ==="
cd /root/coworkprysme_v2/packages/db && node -e "
import mongoose from 'mongoose';
const uri='mongodb://coworkprysme_app:BC3S2KDyXi9GyTXhkHjfIADLRUd0YapuOvyQqzymLRbrhVGD40@127.0.0.1:27017/?authSource=admin&directConnection=true';
await mongoose.connect(uri);
const doc = await mongoose.connection.useDb('cowork_bdd').collection('buildings').findOne({name:'Demo Phase 2 Cowork'});
console.log(JSON.stringify({name:doc?.name, zip:doc?.address?.zip, coordinates:doc?.coordinates}, null, 2));
await mongoose.disconnect();
"

echo "=== 6) Session WITHOUT spaces permission → expect 403 ==="
NO_SPACES_TOKEN=$(cd /root/coworkprysme_v2/apps/gestion/Backend && node scripts/demo-session-no-spaces.mjs)
curl -sS -b "gestion_sid=$NO_SPACES_TOKEN" "$API/buildings" -w "\nHTTP %{http_code}\n"

rm -f "$COOKIE_JAR"
