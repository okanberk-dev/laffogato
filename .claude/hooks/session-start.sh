#!/bin/bash
# Claude Code on the web — SessionStart hook for Laffogato.
# Installs Node dependencies so typecheck/lint/build work out of the box.
# Idempotent and non-interactive; safe to run on every session start.
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment. Local sessions
# manage their own node_modules and should not be slowed down by this hook.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Disable Next.js telemetry prompts/output during automated installs.
export NEXT_TELEMETRY_DISABLED=1

echo "[session-start] Installing npm dependencies..."
# Prefer `npm install` over `npm ci` so the cached container state can be
# reused across sessions instead of wiping node_modules each time.
npm install --no-audit --no-fund

echo "[session-start] Dependencies ready."
