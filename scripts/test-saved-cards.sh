#!/usr/bin/env bash
# Saved-card tests (docs/PAYNKOLAY.md §16.3, tests/saved-cards/README.md).
#
#   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/laf_test npm run test:saved-cards
#
# Starts the PayNkolay mock and the built app (next start) with test-only
# secrets, runs the six test files, stops both. The database must be a local,
# throwaway one: the tests write customers and orders and close accounts.
# SKIP_BUILD=1 reuses the existing .next build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  cat >&2 <<'MSG'
TEST_DATABASE_URL is not set. Point it at a local, empty Postgres, e.g.:
  docker run -d --name laf-test-db -p 5433:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16
  createdb -h 127.0.0.1 -p 5433 -U postgres laf_test
  TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/laf_test npm run test:saved-cards
MSG
  exit 2
fi
case "$TEST_DATABASE_URL" in
  *@127.0.0.1:* | *@127.0.0.1/* | *@localhost:* | *@localhost/*) ;;
  *) echo "TEST_DATABASE_URL must point at 127.0.0.1 or localhost" >&2; exit 2 ;;
esac

APP_PORT="${TEST_APP_PORT:-3124}"
MOCK_PORT="${TEST_MOCK_PORT:-4010}"
LOG_DIR="$(mktemp -d)"
export SERVER_LOG="$LOG_DIR/server.log"

# Test-only values. Nothing here is a real secret; PayNkolay is the mock.
export DATABASE_URL="$TEST_DATABASE_URL"
export PAYMENT_PROVIDER=paynkolay
export PAYNKOLAY_SX=sx-test
export PAYNKOLAY_SX_LIST=sx-list-test
export PAYNKOLAY_SX_CANCEL=sx-cancel-test
export PAYNKOLAY_MERCHANT_SECRET_KEY=merchant-secret-test
export PAYNKOLAY_MERCHANT_NO=123456
export PAYNKOLAY_BASE_URL="http://127.0.0.1:$MOCK_PORT"
export PAYNKOLAY_SUCCESS_URL="http://localhost:$APP_PORT/odeme/donus"
export PAYNKOLAY_FAIL_URL="http://localhost:$APP_PORT/odeme/donus"
export PAYNKOLAY_CHECKOUT_MODE=direct
export PAYNKOLAY_CARD_STORAGE=on
export CARD_VAULT_KEY=test-vault-key-0123456789-abcdefghijklmnop
export CUSTOMER_SESSION_SECRET=customer-session-secret-for-tests-0123456789
export ADMIN_SESSION_SECRET=admin-session-secret-for-tests-0123456789abc
export NEXT_PUBLIC_SITE_URL="http://localhost:$APP_PORT"
export CRON_SECRET=cron-secret-test
export TEST_APP_URL="http://localhost:$APP_PORT"
export TEST_MOCK_URL="http://127.0.0.1:$MOCK_PORT"
# Never reach a real mail or identity provider from a test run.
unset RESEND_API_KEY SUPABASE_SECRET_KEY SUPABASE_SERVICE_ROLE_KEY || true

# The schema first: the tests write rows before the app's first query
# would create it.
node scripts/db-migrate.mjs

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
for port in "$APP_PORT" "$MOCK_PORT"; do
  if port_busy "$port"; then
    echo "port $port is already in use; stop what runs there first" >&2
    exit 2
  fi
done

# Each server runs in its own process group (setsid), so stopping it stops
# npx and everything it started.
pgids=()
cleanup() {
  for pg in "${pgids[@]}"; do kill -- "-$pg" 2>/dev/null || true; done
}
trap cleanup EXIT

MOCK_PORT="$MOCK_PORT" MOCK_SECRET="$PAYNKOLAY_MERCHANT_SECRET_KEY" MOCK_SX="$PAYNKOLAY_SX" \
  setsid node tests/saved-cards/mock-paynkolay.mjs >"$LOG_DIR/mock.log" 2>&1 &
pgids+=($!)

if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  # The build reads no secret; NODE_ENV is set only because some shells
  # export NODE_ENV=development, which breaks `next build` (CLAUDE.md).
  NODE_ENV=production npx next build
fi

NODE_ENV=production setsid npx next start -p "$APP_PORT" >"$SERVER_LOG" 2>&1 &
pgids+=($!)

wait_for() {
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null -f "$1"; then return 0; fi
    sleep 1
  done
  echo "not up: $1 (logs in $LOG_DIR)" >&2
  exit 1
}
wait_for "http://127.0.0.1:$MOCK_PORT/__state"
wait_for "http://localhost:$APP_PORT/uye/giris"

npx vitest run --config tests/saved-cards/vitest.config.mts "$@"
