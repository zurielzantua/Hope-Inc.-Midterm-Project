-- S1-DBA-05: seed default roles, business modules, and action rights.
-- This migration intentionally does not create Auth users or store passwords.

DO $seed$
DECLARE
    r RECORD;
    v_role_id BIGINT;
    v_module_id BIGINT;
    v_right_module_id BIGINT;
BEGIN
    -- Restore a matching soft-deleted role rather than attempting a duplicate
    -- insert. Existing active role IDs and names are never overwritten.
    FOR r IN
        SELECT *
        FROM (VALUES
            ('superadmin', 'Superadmin'),
            ('admin',      'Admin'),
            ('user',       'User')
        ) AS seed(role_code, role_name)
    LOOP
        SELECT role_id
          INTO v_role_id
          FROM public.role
         WHERE role_code = r.role_code;

        IF NOT FOUND THEN
            INSERT INTO public.role (role_code, role_name)
            VALUES (r.role_code, r.role_name);
        ELSE
            IF EXISTS (
                SELECT 1
                  FROM public.role
                 WHERE role_id = v_role_id
                   AND role_name <> r.role_name
            ) THEN
                RAISE EXCEPTION
                    'S1-DBA-05 role code "%" already has a different name',
                    r.role_code;
            END IF;

            UPDATE public.role
               SET is_deleted = false
             WHERE role_id = v_role_id
               AND is_deleted;
        END IF;
    END LOOP;

    -- User Management is intentionally not a business module in this seed.
    FOR r IN
        SELECT *
        FROM (VALUES
            ('customer',       'Customer'),
            ('product',        'Product'),
            ('human_resources','Human Resources'),
            ('sales',           'Sales'),
            ('reports',         'Reports')
        ) AS seed(module_code, module_name)
    LOOP
        SELECT module_id
          INTO v_module_id
          FROM public.module
         WHERE module_code = r.module_code;

        IF NOT FOUND THEN
            INSERT INTO public.module (module_code, module_name)
            VALUES (r.module_code, r.module_name)
            RETURNING module_id INTO v_module_id;
        ELSE
            IF EXISTS (
                SELECT 1
                  FROM public.module
                 WHERE module_id = v_module_id
                   AND module_name <> r.module_name
            ) THEN
                RAISE EXCEPTION
                    'S1-DBA-05 module code "%" already has a different name',
                    r.module_code;
            END IF;

            UPDATE public.module
               SET is_deleted = false
             WHERE module_id = v_module_id
               AND is_deleted;
        END IF;
    END LOOP;

    FOR r IN
        SELECT *
        FROM (VALUES
            ('customer', 'add_customer',           'Add Customer'),
            ('customer', 'edit_customer',          'Edit Customer'),
            ('customer', 'delete_customer',        'Delete Customer'),
            ('product',  'add_product',             'Add Product'),
            ('product',  'edit_product',            'Edit Product'),
            ('product',  'delete_product',          'Delete Product'),
            ('product',  'add_price',               'Add Price'),
            ('product',  'edit_price',              'Edit Price'),
            ('product',  'delete_price',            'Delete Price'),
            ('human_resources', 'add_job',          'Add Job'),
            ('human_resources', 'edit_job',         'Edit Job'),
            ('human_resources', 'delete_job',       'Delete Job'),
            ('human_resources', 'add_department',   'Add Department'),
            ('human_resources', 'edit_department',  'Edit Department'),
            ('human_resources', 'delete_department','Delete Department'),
            ('human_resources', 'add_employee',     'Add Employee'),
            ('human_resources', 'edit_employee',    'Edit Employee'),
            ('human_resources', 'delete_employee',  'Delete Employee'),
            ('human_resources', 'view_job_history', 'View Job History'),
            ('human_resources', 'add_job_history',  'Add Job History'),
            ('human_resources', 'edit_job_history', 'Edit Job History'),
            ('human_resources', 'delete_job_history','Delete Job History'),
            ('sales', 'add_sale',                   'Add Sale'),
            ('sales', 'edit_sale',                  'Edit Sale'),
            ('sales', 'delete_sale',                'Delete Sale'),
            ('sales', 'view_sale_detail',           'View Sale Detail'),
            ('sales', 'add_sale_detail',             'Add Sale Detail'),
            ('sales', 'edit_sale_detail',            'Edit Sale Detail'),
            ('sales', 'delete_sale_detail',          'Delete Sale Detail'),
            ('reports', 'top_customers',             'Top Customers'),
            ('reports', 'product_master_list',       'Product Master List'),
            ('reports', 'top_products',              'Top Products'),
            ('reports', 'active_employees',          'Active Employees'),
            ('reports', 'all_employees',             'All Employees'),
            ('reports', 'employee_job_history',     'Employee Job History'),
            ('reports', 'top_sales',                 'Top Sales')
        ) AS seed(module_code, right_code, right_name)
    LOOP
        SELECT module_id
          INTO v_right_module_id
          FROM public.right_catalog
         WHERE right_code = r.right_code;

        IF NOT FOUND THEN
            SELECT module_id
              INTO v_module_id
              FROM public.module
             WHERE module_code = r.module_code;

            INSERT INTO public.right_catalog
                (module_id, right_code, right_name)
            VALUES
                (v_module_id, r.right_code, r.right_name);
        ELSE
            IF v_right_module_id <> (
                SELECT module_id
                  FROM public.module
                 WHERE module_code = r.module_code
            ) THEN
                RAISE EXCEPTION
                    'S1-DBA-05 right code "%" belongs to a different module',
                    r.right_code;
            END IF;

            IF EXISTS (
                SELECT 1
                  FROM public.right_catalog
                 WHERE right_code = r.right_code
                   AND right_name <> r.right_name
            ) THEN
                RAISE EXCEPTION
                    'S1-DBA-05 right code "%" already has a different name',
                    r.right_code;
            END IF;

            UPDATE public.right_catalog
               SET is_deleted = false
             WHERE right_code = r.right_code
               AND is_deleted;
        END IF;
    END LOOP;
END;
$seed$;
