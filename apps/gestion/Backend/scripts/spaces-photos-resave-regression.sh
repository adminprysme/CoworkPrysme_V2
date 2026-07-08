#!/usr/bin/env bash
# Regression: space with photo → GET → PATCH space (re-save) → PATCH photos unchanged → photo preserved.
# Spaces omit photos from update payload (unlike buildings create mapper); this script guards against regressions.
set -euo pipefail

API="http://127.0.0.1:8003"
UPLOADS_DIR="${UPLOADS_DIR:-/root/coworkprysme_v2/uploads}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd /root/coworkprysme_v2/apps/gestion/Backend
set -a && source .env && set +a
TOKEN=$(node scripts/demo-session.mjs)

BUILDING_ID="${1:-}"
if [[ -z "$BUILDING_ID" ]]; then
  BUILDING_ID=$(curl -sS -b "gestion_sid=$TOKEN" "$API/buildings" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.buildings[0]?.id||'')")
fi
[[ -n "$BUILDING_ID" ]] || { echo "No building id" >&2; exit 1; }

SCHEDULE='[
  {"day":"monday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"tuesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"wednesday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"thursday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"friday","is24h":false,"openTime":"08:00","closeTime":"19:00"},
  {"day":"saturday","is24h":false,"openTime":"08:00","closeTime":"13:00"},
  {"day":"sunday","is24h":false,"openTime":"00:00","closeTime":"00:00"}
]'

SPACE_PAYLOAD=$(node -e "
console.log(JSON.stringify({
  type:'meeting_room',
  name:'Regression resave space',
  description:'',
  floor:'RDC',
  capacity:4,
  equipments:[],
  openingHours:$SCHEDULE,
  accessCode:'',
  status:'active',
  tariffs:[],
}));
")

echo "=== Create space ==="
curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/buildings/$BUILDING_ID/spaces" \
  -H "Content-Type: application/json" -d "$SPACE_PAYLOAD" -o "$TMP_DIR/space.json" -w "HTTP %{http_code}\n"
SPACE_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_DIR/space.json','utf8')).id)")

node <<NODE
import sharp from "sharp";
await sharp({ create: { width: 32, height: 32, channels: 3, background: "#16a34a" } })
  .webp()
  .toFile("$TMP_DIR/photo.webp");
NODE

echo "=== Upload photo ==="
curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/spaces/$SPACE_ID/photos" \
  -F "file=@$TMP_DIR/photo.webp" -o "$TMP_DIR/after-upload.json" -w "HTTP %{http_code}\n"
STORAGE_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-upload.json','utf8')).photos[0].storageKey)")
echo "storageKey=$STORAGE_KEY"

echo "=== GET (simulate refresh) ==="
curl -sS -b "gestion_sid=$TOKEN" "$API/spaces/$SPACE_ID" -o "$TMP_DIR/after-get.json"
GET_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-get.json','utf8')).photos[0].storageKey)")
[[ "$GET_KEY" == "$STORAGE_KEY" ]] || { echo "GET key mismatch"; exit 1; }

echo "=== PATCH space (re-save without changes) ==="
curl -sS -b "gestion_sid=$TOKEN" -X PATCH "$API/spaces/$SPACE_ID" \
  -H "Content-Type: application/json" -d "$SPACE_PAYLOAD" \
  -o "$TMP_DIR/after-patch-space.json" -w "HTTP %{http_code}\n"
PATCH_SPACE_PHOTOS=$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-patch-space.json','utf8')).photos))")
echo "photos after PATCH space: $PATCH_SPACE_PHOTOS"
[[ "$PATCH_SPACE_PHOTOS" != "[]" ]] || { echo "FAIL: PATCH space wiped photos"; exit 1; }

echo "=== PATCH photos (re-save metadata, no changes) ==="
HTTP=$(curl -sS -b "gestion_sid=$TOKEN" -X PATCH "$API/spaces/$SPACE_ID/photos" \
  -H "Content-Type: application/json" \
  -d "{\"photos\":[{\"storageKey\":\"$STORAGE_KEY\",\"order\":0,\"isPrimary\":true}]}" \
  -o "$TMP_DIR/after-patch-photos.json" -w "%{http_code}")
echo "HTTP $HTTP"
[[ "$HTTP" == "200" ]] || { cat "$TMP_DIR/after-patch-photos.json"; exit 1; }

FINAL_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-patch-photos.json','utf8')).photos[0].storageKey)")
[[ "$FINAL_KEY" == "$STORAGE_KEY" ]] || { echo "Final key mismatch"; exit 1; }
[[ -f "$UPLOADS_DIR/$STORAGE_KEY" ]] || { echo "File missing on disk"; exit 1; }

echo "=== PASS: space photo preserved across re-save ==="
