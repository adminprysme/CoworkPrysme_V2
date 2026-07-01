#!/usr/bin/env bash
set -euo pipefail

API="http://127.0.0.1:8003"
ROOT="/root/coworkprysme_v2/apps/gestion/Backend"

SCHEDULE='[
  {"day":"monday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"tuesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"wednesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"thursday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"friday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"saturday","is24h":false,"openTime":"08:00","closeTime":"13:00"},
  {"day":"sunday","is24h":false,"openTime":"00:00","closeTime":"00:00"}
]'

TARIFFS='[
  {"durationClass":"hourly","priceEuros":19.99,"vatRate":20,"enabled":true},
  {"durationClass":"halfday","priceEuros":80,"vatRate":20,"enabled":true},
  {"durationClass":"daily","priceEuros":120,"vatRate":20,"enabled":true},
  {"durationClass":"weekly","priceEuros":450,"vatRate":20,"enabled":false}
]'

echo "=== Session with spaces permission ==="
TOKEN=$(cd "$ROOT" && node scripts/demo-session.mjs)

echo "=== Pick existing building ==="
BUILDING_ID=$(curl -sS -b "gestion_sid=$TOKEN" "$API/buildings" \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.buildings[0]?.id||'');")
if [ -z "$BUILDING_ID" ]; then
  echo "No building found — create one first."
  exit 1
fi
echo "buildingId=$BUILDING_ID"

SPACE_NAME="Demo Tarifs $(date +%s)"
echo "=== Create space with tariffs ==="
curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/buildings/$BUILDING_ID/spaces" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"meeting_room\",
    \"name\": \"$SPACE_NAME\",
    \"description\": \"Espace démo tarifs.\",
    \"floor\": \"RDC\",
    \"capacity\": 6,
    \"equipments\": [{\"key\":\"wifi\",\"label\":\"Wifi\"}],
    \"openingHours\": $SCHEDULE,
    \"accessCode\": \"7788\",
    \"status\": \"active\",
    \"tariffs\": $TARIFFS
  }" \
  -o /tmp/demo-space-tariffs-create.json -w "HTTP %{http_code}\n"

SPACE_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-space-tariffs-create.json','utf8')).id)")
echo "spaceId=$SPACE_ID"
node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/demo-space-tariffs-create.json','utf8')); console.log('API tariffs:', JSON.stringify(d.tariffs,null,2));"

echo "=== MongoDB tariffs (centimes) ==="
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a
cd /root/coworkprysme_v2/packages/db
node --input-type=module <<NODE
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI);
const doc = await mongoose.connection.useDb("cowork_bdd").collection("spaces").findOne({
  _id: new mongoose.Types.ObjectId("${SPACE_ID}"),
});
console.log(JSON.stringify(doc?.tariffs ?? [], null, 2));
await mongoose.disconnect();
NODE

echo "=== PATCH update (20.00 € daily, disable halfday) ==="
curl -sS -b "gestion_sid=$TOKEN" -X PATCH "$API/spaces/$SPACE_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"meeting_room\",
    \"name\": \"$SPACE_NAME\",
    \"description\": \"Espace démo tarifs.\",
    \"floor\": \"RDC\",
    \"capacity\": 6,
    \"equipments\": [{\"key\":\"wifi\",\"label\":\"Wifi\"}],
    \"openingHours\": $SCHEDULE,
    \"accessCode\": \"7788\",
    \"status\": \"active\",
    \"tariffs\": [
      {\"durationClass\":\"hourly\",\"priceEuros\":19.99,\"vatRate\":20,\"enabled\":true},
      {\"durationClass\":\"halfday\",\"priceEuros\":80,\"vatRate\":20,\"enabled\":false},
      {\"durationClass\":\"daily\",\"priceEuros\":20,\"vatRate\":20,\"enabled\":true}
    ]
  }" \
  -o /tmp/demo-space-tariffs-update.json -w "HTTP %{http_code}\n"

node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/demo-space-tariffs-update.json','utf8')); console.log('Updated API tariffs:', JSON.stringify(d.tariffs,null,2));"

echo "=== Reload GET ==="
curl -sS -b "gestion_sid=$TOKEN" "$API/spaces/$SPACE_ID" \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(d.tariffs,null,2));"

echo "=== 403 without spaces permission ==="
NO_SPACES_TOKEN=$(node "$ROOT/scripts/demo-session-no-spaces.mjs")
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -b "gestion_sid=$NO_SPACES_TOKEN" \
  -X PATCH "$API/spaces/$SPACE_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"meeting_room\",
    \"name\": \"$SPACE_NAME\",
    \"description\": \"Espace démo tarifs.\",
    \"floor\": \"RDC\",
    \"capacity\": 6,
    \"equipments\": [{\"key\":\"wifi\",\"label\":\"Wifi\"}],
    \"openingHours\": $SCHEDULE,
    \"accessCode\": \"7788\",
    \"status\": \"active\",
    \"tariffs\": [{\"durationClass\":\"hourly\",\"priceEuros\":10,\"vatRate\":20,\"enabled\":true}]
  }")
echo "PATCH without permission => HTTP $HTTP"

HTTP2=$(curl -sS -o /dev/null -w "%{http_code}" -b "gestion_sid=$NO_SPACES_TOKEN" "$API/buildings/$BUILDING_ID/spaces")
echo "GET list without permission => HTTP $HTTP2"

echo "=== DONE ==="
