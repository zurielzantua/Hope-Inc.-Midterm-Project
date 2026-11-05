#!/usr/bin/env bash
# S1-DEV-06 two-session last-Superadmin guard test.
# Run only against an empty disposable PostgreSQL database:
#   HOPE_ISOLATED_DATABASE_URL=postgresql://... \
#     bash supabase/tests/hope_last_superadmin_guard_concurrency.sh
#
# Session A blocks one of two active Superadmins, then holds the transaction
# open while its trigger holds the advisory lock. Session B tries to block the
# other Superadmin. The second write must wait, recheck after A commits, and
# fail rather than leaving no active Superadmin.

set -euo pipefail

: "${HOPE_ISOLATED_DATABASE_URL:?Set HOPE_ISOLATED_DATABASE_URL to an empty disposable database}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
url="$HOPE_ISOLATED_DATABASE_URL"
tmp="$(mktemp -d)"
cleanup() {
  psql "$url" -q -c "DROP TABLE IF EXISTS public.app_user CASCADE; DROP TABLE IF EXISTS public.role CASCADE;" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

psql "$url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/hope_last_superadmin_guard_concurrency.sql"

psql "$url" -v ON_ERROR_STOP=1 -q -c "
  BEGIN;
  UPDATE public.app_user SET is_blocked = TRUE
   WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';
  SELECT pg_sleep(3);
  COMMIT;
" >"$tmp/session-a.out" 2>"$tmp/session-a.err" &
session_a=$!

lock_seen=0
for _ in $(seq 1 100); do
  if [ "$(psql "$url" -tAc "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND classid = 1213154352 AND objid = 605 AND granted")" = "1" ]; then
    lock_seen=1
    break
  fi
  if ! kill -0 "$session_a" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

if [ "$lock_seen" != "1" ]; then
  echo "FAIL: session A never acquired the Superadmin guard lock" >&2
  cat "$tmp/session-a.err" >&2 || true
  wait "$session_a" || true
  exit 1
fi

set +e
psql "$url" -v ON_ERROR_STOP=1 -q -c "
  BEGIN;
  UPDATE public.app_user SET is_blocked = TRUE
   WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';
  COMMIT;
" >"$tmp/session-b.out" 2>"$tmp/session-b.err"
session_b_status=$?
set -e

if ! wait "$session_a"; then
  echo "FAIL: session A did not commit its permitted block" >&2
  cat "$tmp/session-a.err" >&2 || true
  exit 1
fi

if [ "$session_b_status" -eq 0 ]; then
  echo "FAIL: the concurrent second block succeeded" >&2
  cat "$tmp/session-b.out" >&2 || true
  exit 1
fi

if ! grep -q "last_active_superadmin" "$tmp/session-b.err"; then
  echo "FAIL: the second block failed without the last_active_superadmin guard" >&2
  cat "$tmp/session-b.err" >&2 || true
  exit 1
fi

active="$(psql "$url" -tAc "
  SELECT count(*)
    FROM public.app_user AS u
    JOIN public.role AS r ON r.role_id = u.role_id
   WHERE r.role_code = 'superadmin'
     AND NOT r.is_deleted
     AND u.account_state = 'approved'
     AND NOT u.is_blocked
     AND NOT u.is_deleted
")"

if [ "$active" != "1" ]; then
  echo "FAIL: expected exactly one active Superadmin after the race, found $active" >&2
  exit 1
fi

echo "PASS: the concurrent second block was rejected and one active Superadmin remains"
