#!/usr/bin/env bash
# Unloads and removes the launchd user agent installed by install.sh.
set -euo pipefail

PLIST_NAME="com.alejandra.alexandria-sync.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

if [ -f "$PLIST_DEST" ]; then
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
  rm -f "$PLIST_DEST"
  echo "Uninstalled: $PLIST_DEST"
else
  echo "Nothing to uninstall — $PLIST_DEST not found."
fi
