#!/usr/bin/env bash
set -euo pipefail

API="http://127.0.0.1:8003"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SCHEDULE='[
  {"day":"monday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"tuesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"wednesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"thursday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"friday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"saturday","is24h":false,"openTime":"08:00","closeTime":"13:00"},
  {"day":"sunday","is24h":false,"openTime":"00:00","closeTime":"00:00"}
]'

BUILDING_PAYLOAD='{
  "name": "Demo Spaces Site",
  "description": "",
  "address": {"street":"47 avenue Leclerc","postalCode":"69003","city":"Lyon","country":"France"},
  "floors":[{"name":"RDC"}],
  "status":"active",
  "accessibilityHours": '"$SCHEDULE"',
  "receptionHours": '"$SCHEDULE"',
  "concierge":{"link":"","accessCode":""}
}'

space_payload() {
  local access_code="$1"
  cat <<JSON
{
  "type": "meeting_room",
  "name": "Salon Identique",
  "description": "Espace de démonstration branché sur l API.",
  "floor": "RDC",
  "capacity": 8,
  "equipments": [{"key":"wifi","label":"Wifi"}],
  "openingHours": $SCHEDULE,
  "accessCode": "$access_code",
  "status": "active"
}
JSON
}

echo "=== Session with spaces permission ==="
TOKEN=$(cd /root/coworkprysme_v2/apps/gestion/Backend && node scripts/demo-session.mjs)

echo "=== Create building A ==="
BUILDING_A=$(curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/buildings" \
  -H "Content-Type: application/json" -d "$BUILDING_PAYLOAD" | tee /tmp/demo-spaces-building-a.json)
BUILDING_A_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-spaces-building-a.json','utf8')).id)")
echo "buildingA=$BUILDING_A_ID"

echo "=== Create building B (for slug collision) ==="
BUILDING_B=$(curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/buildings" \
  -H "Content-Type: application/json" -d "$(echo "$BUILDING_PAYLOAD" | sed 's/Demo Spaces Site/Demo Spaces Site B/')" \
  | tee /tmp/demo-spaces-building-b.json)
BUILDING_B_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-spaces-building-b.json','utf8')).id)")
echo "buildingB=$BUILDING_B_ID"

echo "=== Create space 1 (accessCode=9911) ==="
curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/buildings/$BUILDING_A_ID/spaces" \
  -H "Content-Type: application/json" \
  -d "$(space_payload 9911)" \
  -o /tmp/demo-space-1.json -w "HTTP %{http_code}\n"
SPACE_1_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-space-1.json','utf8')).id)")
SPACE_1_SLUG=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-space-1.json','utf8')).seo.slug)")
echo "space1=$SPACE_1_ID slug=$SPACE_1_SLUG"

echo "=== Create space 2 same name in building B (slug collision) ==="
curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/buildings/$BUILDING_B_ID/spaces" \
  -H "Content-Type: application/json" \
  -d "$(space_payload 8822)" \
  -o /tmp/demo-space-2.json -w "HTTP %{http_code}\n"
SPACE_2_SLUG=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-space-2.json','utf8')).seo.slug)")
SPACE_2_ACCESS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-space-2.json','utf8')).accessCode)")
echo "space2 slug=$SPACE_2_SLUG accessCode=$SPACE_2_ACCESS"

echo "=== Reload space 1 ==="
curl -sS -b "gestion_sid=$TOKEN" "$API/spaces/$SPACE_1_ID" \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('accessCode:', d.accessCode, 'seo:', d.seo.slug);"

echo "=== Upload photo ==="
cd /root/coworkprysme_v2/apps/gestion/Backend
node <<NODE
import sharp from "sharp";
await sharp({
  create: { width: 640, height: 480, channels: 3, background: "#2563eb" },
}).webp().toFile("$TMP_DIR/space-photo.webp");
NODE
curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/spaces/$SPACE_1_ID/photos" \
  -F "file=@$TMP_DIR/space-photo.webp" \
  -o /tmp/demo-space-photo.json -w "HTTP %{http_code}\n"
node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/demo-space-photo.json','utf8')); console.log('photos:', d.photos.length, 'primary:', d.photos[0]?.isPrimary);"

echo "=== 403 without spaces permission ==="
NO_SPACES_TOKEN=$(node scripts/demo-session-no-spaces.mjs)
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -b "gestion_sid=$NO_SPACES_TOKEN" "$API/buildings/$BUILDING_A_ID/spaces")
echo "GET /buildings/:id/spaces without permission => HTTP $HTTP"

echo "=== DONE ==="
echo "slug collision: $SPACE_1_SLUG vs $SPACE_2_SLUG"
