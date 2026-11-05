-- S1-DBA-06 follow-up: fit full authenticated UUID attribution in stamp VARCHAR(60).
-- audit_log.action_by retains the full actor; long system-role names are shortened
-- only in the display stamp so RESTORE remains within the existing column width.

CREATE OR REPLACE FUNCTION public.audit_stamp(p_action TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT p_action || ' ' || left(public.audit_user(), 36) || ' ' ||
           to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYYMMDD HH24:MI');
$$;

COMMENT ON FUNCTION public.audit_stamp(TEXT) IS
'Builds a stamp within VARCHAR(60), retaining full UUID actors and a compact Manila timestamp; audit_log stores the complete action_by value.';
