#!/usr/bin/env bash
# Two-session race test for S2-DBA-04. Run only on a disposable database after
# all project migrations (including S2-DBA-04) have been applied. Configure
# standard libpq variables (PGHOST, PGPORT, PGUSER, PGDATABASE, and PGPASSWORD
# or PGPASSFILE) before running this script.

set -euo pipefail

: "${PGHOST:?Set PGHOST for an isolated disposable database}"
: "${PGUSER:?Set PGUSER for an isolated disposable database}"
: "${PGDATABASE:?Set PGDATABASE for an isolated disposable database}"
command -v psql >/dev/null || { echo 'psql is required' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'python3 is required' >&2; exit 1; }

temporary_dir="$(mktemp -d)"
customer_parent_pid=''
customer_child_pid=''
product_child_pid=''
product_parent_pid=''
cleanup() {
  for session_pid in "$customer_parent_pid" "$customer_child_pid" "$product_child_pid" "$product_parent_pid"; do
    if [[ -n "$session_pid" ]] && kill -0 "$session_pid" 2>/dev/null; then
      kill "$session_pid" 2>/dev/null || true
      wait "$session_pid" 2>/dev/null || true
    fi
  done
  rm -rf "$temporary_dir"
}
trap cleanup EXIT

suffix="$(python3 -c 'import secrets; print(secrets.token_hex(2).upper())')"
customer_no="Q${suffix}"
product_code="P${suffix}X"
employee_no="$(psql -X -Atqc 'SELECT empno FROM public.employee ORDER BY empno LIMIT 1')"
if [[ -z "$employee_no" ]]; then
  echo 'No employee fixture is available for the concurrency test.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -q \
  -v customer_no="$customer_no" -v product_code="$product_code" \
  -c "INSERT INTO public.customer (custno,custname,address,payterm) VALUES (:'customer_no','DBA04 race customer','Disposable fixture','COD'); INSERT INTO public.product (prodcode,description,unit) VALUES (:'product_code','DBA04 race product','pc');"

wait_for_file() {
  local marker="$1"
  for _ in $(seq 1 100); do
    [[ -e "$marker" ]] && return 0
    sleep 0.1
  done
  return 1
}

wait_for_lock() {
  local app_name="$1"
  for _ in $(seq 1 100); do
    local waiting
    waiting="$(psql -X -Atqc "SELECT count(*) FROM pg_stat_activity WHERE application_name = '${app_name}' AND wait_event_type = 'Lock'")"
    [[ "$waiting" -gt 0 ]] && return 0
    sleep 0.1
  done
  return 1
}

# Parent-first: the child writer must wait, then reject the now-inactive parent.
export S2_DBA04_READY_FILE="$temporary_dir/customer-parent-ready"
cat >"$temporary_dir/customer-parent.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
UPDATE public.customer SET is_deleted = TRUE WHERE custno = '$customer_no';
\! touch "\$S2_DBA04_READY_FILE"
SELECT pg_sleep(8);
COMMIT;
SQL
PGAPPNAME="dba04-customer-parent-${suffix}" psql -X -v ON_ERROR_STOP=1 -q -f "$temporary_dir/customer-parent.sql" \
  >"$temporary_dir/customer-parent.log" 2>&1 &
customer_parent_pid=$!
if ! wait_for_file "$S2_DBA04_READY_FILE"; then
  echo 'Customer parent transaction did not acquire its soft-delete lock.' >&2
  cat "$temporary_dir/customer-parent.log" >&2 || true
  exit 1
fi

PGAPPNAME="dba04-customer-child-${suffix}" psql -X -v ON_ERROR_STOP=1 -q \
  -v customer_no="$customer_no" -v trans_no="$customer_sale" -v employee_no="$employee_no" \
  -c "INSERT INTO public.sales (transno,salesdate,custno,empno) VALUES (:'trans_no',CURRENT_DATE,:'customer_no',:'employee_no');" \
  >"$temporary_dir/customer-child.log" 2>&1 &
customer_child_pid=$!
if ! wait_for_lock "dba04-customer-child-${suffix}"; then
  echo 'Customer child insert did not wait on the locked parent row.' >&2
  cat "$temporary_dir/customer-child.log" >&2 || true
  exit 1
fi
wait "$customer_parent_pid"
customer_parent_pid=''
if wait "$customer_child_pid"; then
  echo 'Customer child insert unexpectedly succeeded after the parent was deactivated.' >&2
  exit 1
else
  customer_child_pid=''
fi
grep -q 'active_parent_required' "$temporary_dir/customer-child.log" || {
  echo 'Customer child insert failed for an unexpected reason.' >&2
  cat "$temporary_dir/customer-child.log" >&2 || true
  exit 1
}

# Child-first: the parent update must wait, then see the committed child and reject.
psql -X -v ON_ERROR_STOP=1 -q -v product_code="$product_code" \
  -c "INSERT INTO public.pricehist (effdate,prodcode,unitprice) VALUES (DATE '2099-01-01',:'product_code',1.00);"
export S2_DBA04_READY_FILE="$temporary_dir/product-child-ready"
cat >"$temporary_dir/product-child.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.pricehist (effdate,prodcode,unitprice) VALUES (DATE '2099-01-02','$product_code',2.00);
\! touch "\$S2_DBA04_READY_FILE"
SELECT pg_sleep(8);
COMMIT;
SQL
PGAPPNAME="dba04-product-child-${suffix}" psql -X -v ON_ERROR_STOP=1 -q -f "$temporary_dir/product-child.sql" \
  >"$temporary_dir/product-child.log" 2>&1 &
product_child_pid=$!
if ! wait_for_file "$S2_DBA04_READY_FILE"; then
  echo 'Product child transaction did not acquire its parent-row lock.' >&2
  cat "$temporary_dir/product-child.log" >&2 || true
  exit 1
fi

PGAPPNAME="dba04-product-parent-${suffix}" psql -X -v ON_ERROR_STOP=1 -q -v product_code="$product_code" \
  -c "UPDATE public.product SET is_deleted = TRUE WHERE prodcode = :'product_code';" \
  >"$temporary_dir/product-parent.log" 2>&1 &
product_parent_pid=$!
if ! wait_for_lock "dba04-product-parent-${suffix}"; then
  echo 'Product soft-delete did not wait on the child transaction lock.' >&2
  cat "$temporary_dir/product-parent.log" >&2 || true
  exit 1
fi
wait "$product_child_pid"
product_child_pid=''
if wait "$product_parent_pid"; then
  echo 'Product soft-delete unexpectedly succeeded after an active price-history row committed.' >&2
  exit 1
else
  product_parent_pid=''
fi
grep -q 'Cannot delete product row: 2 active related record(s) still exist.' "$temporary_dir/product-parent.log" || {
  echo 'Product soft-delete failed for an unexpected reason.' >&2
  cat "$temporary_dir/product-parent.log" >&2 || true
  exit 1
}

echo 'PASS: parent-first and child-first races preserve the active-child invariant.'
