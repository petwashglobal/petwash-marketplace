#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: ./scripts/ios/install-app-icon.sh /path/to/source.png /path/to/AppIcon.appiconset"
  exit 1
fi

SOURCE="$1"
APPICON_DIR="$2"

if [[ ! -f "$SOURCE" ]]; then
  echo "Source PNG not found: $SOURCE"
  exit 1
fi

if [[ ! -d "$APPICON_DIR" ]]; then
  echo "AppIcon.appiconset not found: $APPICON_DIR"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${APPICON_DIR}.backup.${STAMP}"
mkdir -p "$BACKUP_DIR"
cp -R "$APPICON_DIR"/. "$BACKUP_DIR"/

sips -s format png -z 1024 1024 "$SOURCE" --out "$APPICON_DIR/AppIcon-1024.png" >/dev/null

cat > "$APPICON_DIR/Contents.json" <<'JSON'
{
  "images" : [
    {
      "filename" : "AppIcon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON

echo "Installed app icon:"
echo "$APPICON_DIR/AppIcon-1024.png"
echo "Backup:"
echo "$BACKUP_DIR"
