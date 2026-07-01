#!/usr/bin/env bash
set -euo pipefail

API="http://127.0.0.1:8003"
UPLOADS_DIR="${UPLOADS_DIR:-/root/coworkprysme_v2/uploads}"
TMP_DIR="$(mktemp -d)"
COOKIE_JAR="$(mktemp)"

cleanup() {
  rm -rf "$TMP_DIR" "$COOKIE_JAR"
}
trap cleanup EXIT

BUILDING_PAYLOAD='{
  "name": "Demo Photos Cowork",
  "address": {
    "street": "47 avenue Leclerc",
    "postalCode": "69003",
    "city": "Lyon",
    "country": "France"
  },
  "floors": [{"name": "RDC"}],
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

echo "=== Prepare 3 PNG test images ==="
cd /root/coworkprysme_v2/apps/gestion/Backend
node <<NODE
import sharp from "sharp";
const dir = "$TMP_DIR";
const colors = ["#2563eb", "#16a34a", "#dc2626"];
for (let index = 0; index < colors.length; index += 1) {
  const target = \`\${dir}/photo-\${index + 1}.png\`;
  await sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: colors[index],
    },
  })
    .png()
    .toFile(target);
  console.log("created", target);
}
NODE

echo "=== Session with spaces permission ==="
TOKEN=$(cd /root/coworkprysme_v2/apps/gestion/Backend && node scripts/demo-session.mjs)

echo "=== Create building ==="
curl -sS -b "gestion_sid=$TOKEN" \
  -X POST "$API/buildings" \
  -H "Content-Type: application/json" \
  -d "$BUILDING_PAYLOAD" \
  -o /tmp/demo-photos-create.json -w "HTTP %{http_code}\n"
BUILDING_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/demo-photos-create.json','utf8')).id)")
echo "buildingId=$BUILDING_ID"

echo "=== Upload 3 photos ==="
for photo in "$TMP_DIR"/photo-*.png; do
  curl -sS -b "gestion_sid=$TOKEN" \
    -X POST "$API/buildings/$BUILDING_ID/photos" \
    -F "file=@${photo};type=image/png" \
    -o /tmp/demo-photos-upload.json -w "upload ${photo##*/} HTTP %{http_code}\n"
done

echo "=== Volume tree ==="
find "$UPLOADS_DIR/buildings/$BUILDING_ID" -type f | sort

echo "=== MongoDB photos[] ==="
cd /root/coworkprysme_v2/packages/db && node -e "
import mongoose from 'mongoose';
const uri='mongodb://coworkprysme_app:BC3S2KDyXi9GyTXhkHjfIADLRUd0YapuOvyQqzymLRbrhVGD40@127.0.0.1:27017/?authSource=admin&directConnection=true';
await mongoose.connect(uri);
const doc = await mongoose.connection.useDb('cowork_bdd').collection('buildings').findOne({ _id: new mongoose.Types.ObjectId('$BUILDING_ID') });
console.log(JSON.stringify(doc?.photos ?? [], null, 2));
await mongoose.disconnect();
"

STORAGE_KEY=$(node -e "const data=JSON.parse(require('fs').readFileSync('/tmp/demo-photos-upload.json','utf8')); console.log(data.photos[0].storageKey);")
FILENAME="${STORAGE_KEY##*/}"

echo "=== GET /media (gestion-api) ==="
curl -sS -o /tmp/demo-media.webp -w "HTTP %{http_code} size=%{size_download}\n" \
  "$API/media/buildings/$BUILDING_ID/$FILENAME"
file /tmp/demo-media.webp

echo "=== Delete first photo ==="
curl -sS -b "gestion_sid=$TOKEN" \
  -X DELETE "$API/buildings/$BUILDING_ID/photos/$FILENAME" \
  -o /tmp/demo-photos-delete.json -w "HTTP %{http_code}\n"

echo "=== Remaining files on volume ==="
find "$UPLOADS_DIR/buildings/$BUILDING_ID" -type f | sort || true
test ! -f "$UPLOADS_DIR/buildings/$BUILDING_ID/$FILENAME" && echo "deleted file absent: OK"

echo "=== Fake JPEG (.txt renamed) → expect 400 ==="
echo "not an image" > "$TMP_DIR/fake.jpg"
curl -sS -b "gestion_sid=$TOKEN" \
  -X POST "$API/buildings/$BUILDING_ID/photos" \
  -F "file=@$TMP_DIR/fake.jpg;type=image/jpeg" \
  -o /tmp/demo-fake.json -w "HTTP %{http_code}\n"
cat /tmp/demo-fake.json
echo

echo "=== Upload without spaces permission → expect 403 ==="
NO_SPACES_TOKEN=$(cd /root/coworkprysme_v2/apps/gestion/Backend && node scripts/demo-session-no-spaces.mjs)
curl -sS -b "gestion_sid=$NO_SPACES_TOKEN" \
  -X POST "$API/buildings/$BUILDING_ID/photos" \
  -F "file=@$TMP_DIR/photo-1.png;type=image/png" \
  -w "\nHTTP %{http_code}\n"

echo "=== Delete building → volume folder removed ==="
curl -sS -b "gestion_sid=$TOKEN" \
  -X DELETE "$API/buildings/$BUILDING_ID" \
  -w "HTTP %{http_code}\n"
test ! -d "$UPLOADS_DIR/buildings/$BUILDING_ID" && echo "building folder absent: OK"
