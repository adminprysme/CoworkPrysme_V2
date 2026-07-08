#!/usr/bin/env bash
# Regression: upload photo → GET → PATCH building (re-save) → PATCH photos unchanged → photo still present.
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
  BUILDINGS=$(curl -sS -b "gestion_sid=$TOKEN" "$API/buildings")
  BUILDING_ID=$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.buildings[0]?.id||'')" "$BUILDINGS")
fi
if [[ -z "$BUILDING_ID" ]]; then
  echo "No building id" >&2
  exit 1
fi

node <<NODE
import sharp from "sharp";
await sharp({ create: { width: 32, height: 32, channels: 3, background: "#2563eb" } })
  .webp()
  .toFile("$TMP_DIR/regression.webp");
NODE

echo "=== Upload photo ==="
curl -sS -b "gestion_sid=$TOKEN" -X POST "$API/buildings/$BUILDING_ID/photos" \
  -F "file=@$TMP_DIR/regression.webp" -o "$TMP_DIR/after-upload.json" -w "HTTP %{http_code}\n"
STORAGE_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-upload.json','utf8')).photos[0].storageKey)")
echo "storageKey=$STORAGE_KEY"

echo "=== GET (simulate refresh) ==="
curl -sS -b "gestion_sid=$TOKEN" "$API/buildings/$BUILDING_ID" -o "$TMP_DIR/after-get.json"
GET_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-get.json','utf8')).photos[0].storageKey)")
[[ "$GET_KEY" == "$STORAGE_KEY" ]] || { echo "GET key mismatch"; exit 1; }

echo "=== PATCH building (re-save without changes) ==="
node -e "
const get=JSON.parse(require('fs').readFileSync('$TMP_DIR/after-get.json','utf8'));
require('fs').writeFileSync('$TMP_DIR/patch-body.json', JSON.stringify({
  name:get.name,
  description:get.description??'',
  address:get.address,
  floors:get.floors.map(f=>({name:f.name})),
  status:get.status,
  accessibilityHours:get.accessibilityHours,
  receptionHours:get.receptionHours,
  concierge:get.concierge,
}));
"
curl -sS -b "gestion_sid=$TOKEN" -X PATCH "$API/buildings/$BUILDING_ID" \
  -H "Content-Type: application/json" -d @"$TMP_DIR/patch-body.json" \
  -o "$TMP_DIR/after-patch-building.json" -w "HTTP %{http_code}\n"
PATCH_BUILDING_PHOTOS=$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-patch-building.json','utf8')).photos))")
echo "photos after PATCH building: $PATCH_BUILDING_PHOTOS"
[[ "$PATCH_BUILDING_PHOTOS" != "[]" ]] || { echo "FAIL: PATCH building wiped photos"; exit 1; }

echo "=== PATCH photos (re-save metadata, no changes) ==="
HTTP=$(curl -sS -b "gestion_sid=$TOKEN" -X PATCH "$API/buildings/$BUILDING_ID/photos" \
  -H "Content-Type: application/json" \
  -d "{\"photos\":[{\"storageKey\":\"$STORAGE_KEY\",\"order\":0,\"isPrimary\":true}]}" \
  -o "$TMP_DIR/after-patch-photos.json" -w "%{http_code}")
echo "HTTP $HTTP"
[[ "$HTTP" == "200" ]] || { cat "$TMP_DIR/after-patch-photos.json"; exit 1; }

FINAL_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_DIR/after-patch-photos.json','utf8')).photos[0].storageKey)")
[[ "$FINAL_KEY" == "$STORAGE_KEY" ]] || { echo "Final key mismatch"; exit 1; }
[[ -f "$UPLOADS_DIR/$STORAGE_KEY" ]] || { echo "File missing on disk"; exit 1; }

echo "=== PASS: photo preserved across re-save ==="
