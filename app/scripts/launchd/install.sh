#!/usr/bin/env bash
# Installs and loads the launchd user agent that runs scripts/sync.mjs on a
# recurring interval. Safe to re-run (unloads any existing copy first).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE="$SCRIPT_DIR/com.alejandra.alexandria-sync.plist.template"
PLIST_NAME="com.alejandra.alexandria-sync.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LOG_DIR="$HOME/Documents/alexandria/data/logs"

NODE_PATH="$(command -v node || true)"
if [ -z "$NODE_PATH" ]; then
  echo "Could not find 'node' on PATH. Install Node.js or edit this script to set NODE_PATH explicitly." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
mkdir -p "$HOME/Library/LaunchAgents"

# Escape characters that are special in a sed replacement (&, \) or that would
# terminate the s|...|...| expression (|), so paths containing them can't
# corrupt the generated plist.
escape_sed() { printf '%s' "$1" | sed -e 's/[&\\|]/\\&/g'; }

sed \
  -e "s|__NODE_PATH__|$(escape_sed "$NODE_PATH")|g" \
  -e "s|__SCRIPT_PATH__|$(escape_sed "$APP_DIR/scripts/sync.mjs")|g" \
  -e "s|__WORKDIR__|$(escape_sed "$APP_DIR")|g" \
  -e "s|__LOG_DIR__|$(escape_sed "$LOG_DIR")|g" \
  "$TEMPLATE" > "$PLIST_DEST"

# Unload any previously-installed copy first so re-running this script (e.g.
# after editing the template) picks up the changes.
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load -w "$PLIST_DEST"

echo "Installed and loaded: $PLIST_DEST"
echo "node:   $NODE_PATH"
echo "script: $APP_DIR/scripts/sync.mjs"
echo "Runs every 5 minutes (StartInterval=300), plus once immediately (RunAtLoad)."
echo
echo "Logs:"
echo "  app-level:     $LOG_DIR/sync.out.log / sync.err.log"
echo "  launchd-level: $LOG_DIR/sync.launchd.out.log / sync.launchd.err.log"
echo
echo "IMPORTANT — macOS privacy (TCC): launchd agents cannot read ~/Documents"
echo "unless the node binary has Full Disk Access. If sync.launchd.err.log shows"
echo "'Operation not permitted' (or no logs appear at all), grant it in:"
echo "  System Settings > Privacy & Security > Full Disk Access > add: $NODE_PATH"
echo "Interactive runs ('npm run sync') work either way — only the scheduled job needs it."
echo
echo "To verify the job runs: launchctl kickstart -k gui/\$(id -u)/com.alejandra.alexandria-sync"
echo "then check $LOG_DIR/sync.out.log for a new entry."
echo
echo "To uninstall: bash \"$SCRIPT_DIR/uninstall.sh\""
