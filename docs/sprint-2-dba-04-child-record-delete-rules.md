# S2-DBA-04 — Customer and Product soft-delete rules

## Enforcement in the current schema

`public.trg_check_children()` is attached as a `BEFORE UPDATE` row trigger on
the business tables. It runs only when `is_deleted` changes from `false` to
`true`; restoring a row does not run the child check.

| Parent | Active children that block soft deletion | Enforcement |
|---|---|---|
| Customer | `sales` rows with the same `custno` and `is_deleted = false` | `trg_check_children()` trigger |
| Product | `salesdetail` rows with the same `prodcode` and `is_deleted = false`, or `pricehist` rows with the same `prodcode` and `is_deleted = false` | `trg_check_children()` trigger |

These rules are not `CHECK` constraints. The foreign keys preserve row identity
and references independently of `is_deleted`; they use the default restrictive
delete behavior, and `trg_block_hard_delete()` also rejects physical deletes.
The audit trigger records soft delete and restore updates. Thus a permitted
soft delete keeps the parent key, dependent rows, and history in place.

The forward migration
`20261122081413_s2_dba_04_active_child_parent_lock.sql` preflights active sales
under inactive customers, active sales details under inactive products, and
active price-history rows under inactive products. It acquires write-blocking
table locks first and raises before DDL if any inconsistent row exists. Apply
it as one normal transactional Supabase migration so the locks span preflight
through trigger installation.

The migration adds child-side `BEFORE INSERT OR UPDATE OF parent-key,is_deleted`
triggers without replacing `trg_check_children()`. Active sales lock the
customer row `FOR UPDATE`; active sales details and price history lock the
product row `FOR UPDATE`. If that parent is inactive, the write fails with
SQLSTATE `23514` and message `active_parent_required`. Inactive child rows can
remain referenced; their attempt to become active is checked again and denied
until the parent is restored.

RLS is an access boundary, not the child-record rule: RLS is enabled on these
tables and the migrations define no ordinary `anon`/`authenticated` policies
for them, so those roles are denied by default. Trusted server/database writes
still execute the row triggers. Under PostgreSQL `READ COMMITTED`, the shared
parent row lock serializes a child write with a parent soft delete: if the
child write gets the lock first, the delete waits and its count check sees that
child; if the delete gets the lock first, the child waits and then sees the
inactive parent. This is the intended race fix; runtime concurrency behavior
remains unverified until `bash supabase/tests/s2_dba_04_child_parent_concurrency.sh`
passes. Stronger transaction isolation levels have not been validated.

## Current database error and proposed API contract

For a blocked soft delete the trigger currently raises SQLSTATE `P0001` with
this message shape:

```text
Cannot delete customer row: 1 active related record(s) still exist.
Cannot delete product row: 2 active related record(s) still exist.
```

The table and count are internal diagnostics. Proposed shared behavior for
S2-DEV-03 (#154) and S2-DEV-06 (#144): each server endpoint recognizes only
this trigger's known error (`P0001` plus an anchored, resource-specific message
pattern) and returns HTTP `409` with a fixed safe message:

```json
{
  "code": "ACTIVE_DEPENDENTS",
  "message": "This customer has active related records and cannot be deactivated."
}
```

For the Product endpoint, use the same code and status with
`This product has active related records and cannot be deactivated.`
Specifically:

```json
{
  "code": "ACTIVE_DEPENDENTS",
  "message": "This product has active related records and cannot be deactivated."
}
```

For a child-write endpoint that encounters the new `23514` /
`active_parent_required` marker, use HTTP `409` with this fixed response:

```json
{
  "code": "INACTIVE_PARENT",
  "message": "This record cannot be linked to an inactive customer or product."
}
```

Do not expose that database marker either.

Do not return raw Postgres/Supabase `message`, `details`, or `hint` fields to the
browser. Other database errors must follow the endpoint's generic safe error
path and must not be mislabeled as an active-child conflict. S2-DEV-03 (#154)
implements the Customer 409 contract. S2-DEV-06 (#144) should use the matching
Product response. Child-write endpoints can map only SQLSTATE `23514` plus
`active_parent_required` to the `INACTIVE_PARENT` response above. PostgreSQL
uses `P0001` when a `RAISE EXCEPTION` omits an explicit SQLSTATE; the existing
parent trigger does so. This is statically verified, not live tested.

## Verification

`supabase/tests/s2_dba_04_child_record_delete_rules.sql` is a rollback-only
regression test for parent-side child blocks, child INSERT/reassignment/
restore guards, allowed soft delete/restore, and reference/audit retention. Run
it only against a disposable database with all project migrations applied.

For the actual two-session interleavings, also run
`bash supabase/tests/s2_dba_04_child_parent_concurrency.sh` against a separate
disposable database with the same migrations and standard libpq connection
environment. It waits until the second session is visibly blocked on the
parent-row lock before allowing the first transaction to finish. Its fixture
rows remain in the disposable database.

This workspace has no PostgreSQL server responding on `127.0.0.1:5432`, so the
SQL and two-session tests have not been executed here. The trigger definition,
lock protocol, and migration transaction behavior were inspected statically;
hosted behavior is unverified.
