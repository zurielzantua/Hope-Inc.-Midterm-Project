-- S1-DBA-03: account, role, module, rights, and user-permission structures.
-- Public registration must create a regular User with Pending approval. The
-- role catalogue is seeded by S1-DBA-05; the default function fails clearly
-- until that seed has been applied.

CREATE TABLE role (
    role_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_code     VARCHAR(30) NOT NULL UNIQUE,
    role_name     VARCHAR(60) NOT NULL,
    description   TEXT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    stamp         VARCHAR(60),
    CONSTRAINT role_code_ck CHECK (role_code = lower(role_code))
);

CREATE TABLE module (
    module_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module_code   VARCHAR(50) NOT NULL UNIQUE,
    module_name   VARCHAR(100) NOT NULL,
    description   TEXT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    stamp         VARCHAR(60),
    CONSTRAINT module_code_ck CHECK (module_code = lower(module_code))
);

CREATE TABLE right_catalog (
    right_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module_id     BIGINT NOT NULL REFERENCES module(module_id),
    right_code    VARCHAR(100) NOT NULL UNIQUE,
    right_name    VARCHAR(120) NOT NULL,
    description   TEXT,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    stamp         VARCHAR(60),
    CONSTRAINT right_code_ck CHECK (right_code = lower(right_code))
);

CREATE TABLE app_user (
    auth_user_id  UUID PRIMARY KEY REFERENCES auth.users(id),
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(320) NOT NULL UNIQUE,
    role_id       BIGINT NOT NULL REFERENCES role(role_id),
    account_state VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (account_state IN ('pending', 'approved')),
    is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    stamp         VARCHAR(60)
);

CREATE OR REPLACE FUNCTION default_user_role_id()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id BIGINT;
BEGIN
    SELECT role_id
      INTO v_role_id
      FROM role
     WHERE role_code = 'user'
       AND NOT is_deleted;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'The default user role is not seeded. Apply S1-DBA-05 before registering users.';
    END IF;

    RETURN v_role_id;
END;
$$;

ALTER TABLE app_user
    ALTER COLUMN role_id SET DEFAULT default_user_role_id();

CREATE TABLE user_permission (
    auth_user_id  UUID NOT NULL REFERENCES app_user(auth_user_id),
    right_id      BIGINT NOT NULL REFERENCES right_catalog(right_id),
    is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    stamp         VARCHAR(60),
    PRIMARY KEY (auth_user_id, right_id)
);

CREATE VIEW role_active AS
    SELECT * FROM role WHERE NOT is_deleted;

CREATE VIEW module_active AS
    SELECT * FROM module WHERE NOT is_deleted;

CREATE VIEW right_catalog_active AS
    SELECT * FROM right_catalog WHERE NOT is_deleted;

CREATE VIEW user_permission_active AS
    SELECT * FROM user_permission WHERE NOT is_deleted;

CREATE TRIGGER role_biu_stamp
    BEFORE INSERT OR UPDATE ON role
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();
CREATE TRIGGER role_aiu_audit
    AFTER INSERT OR UPDATE ON role
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('role_id');
CREATE TRIGGER role_bd_block
    BEFORE DELETE ON role
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();
CREATE TRIGGER role_bt_block
    BEFORE TRUNCATE ON role
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER module_biu_stamp
    BEFORE INSERT OR UPDATE ON module
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();
CREATE TRIGGER module_aiu_audit
    AFTER INSERT OR UPDATE ON module
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('module_id');
CREATE TRIGGER module_bd_block
    BEFORE DELETE ON module
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();
CREATE TRIGGER module_bt_block
    BEFORE TRUNCATE ON module
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER right_catalog_biu_stamp
    BEFORE INSERT OR UPDATE ON right_catalog
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();
CREATE TRIGGER right_catalog_aiu_audit
    AFTER INSERT OR UPDATE ON right_catalog
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('right_id');
CREATE TRIGGER right_catalog_bd_block
    BEFORE DELETE ON right_catalog
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();
CREATE TRIGGER right_catalog_bt_block
    BEFORE TRUNCATE ON right_catalog
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER app_user_biu_stamp
    BEFORE INSERT OR UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();
CREATE TRIGGER app_user_aiu_audit
    AFTER INSERT OR UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('auth_user_id');
CREATE TRIGGER app_user_bd_block
    BEFORE DELETE ON app_user
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();
CREATE TRIGGER app_user_bt_block
    BEFORE TRUNCATE ON app_user
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER user_permission_biu_stamp
    BEFORE INSERT OR UPDATE ON user_permission
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();
CREATE TRIGGER user_permission_aiu_audit
    AFTER INSERT OR UPDATE ON user_permission
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('auth_user_id', 'right_id');
CREATE TRIGGER user_permission_bd_block
    BEFORE DELETE ON user_permission
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();
CREATE TRIGGER user_permission_bt_block
    BEFORE TRUNCATE ON user_permission
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

ALTER TABLE role ENABLE ROW LEVEL SECURITY;
ALTER TABLE module ENABLE ROW LEVEL SECURITY;
ALTER TABLE right_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission ENABLE ROW LEVEL SECURITY;

-- Catalogues are readable to signed-in users, but all writes remain trusted
-- server-side operations. Account and permission records are self-readable
-- only; privileged account administration is added by the application layer.
CREATE POLICY role_authenticated_read ON role
    FOR SELECT TO authenticated
    USING (NOT is_deleted);

CREATE POLICY module_authenticated_read ON module
    FOR SELECT TO authenticated
    USING (NOT is_deleted);

CREATE POLICY right_catalog_authenticated_read ON right_catalog
    FOR SELECT TO authenticated
    USING (NOT is_deleted);

CREATE POLICY app_user_self_read ON app_user
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid() AND NOT is_deleted);

CREATE POLICY user_permission_self_read ON user_permission
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid() AND NOT is_deleted);
