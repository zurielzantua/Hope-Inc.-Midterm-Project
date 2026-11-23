-- S2-DBA-01: ordered access paths for the active Customer and Product lists.
-- Their identifiers already have primary-key indexes. Search-specific indexes
-- are deferred until the implemented query operators are measured in DBA-06.
CREATE INDEX IF NOT EXISTS customer_active_name_idx
    ON public.customer (custname, custno)
    WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS product_active_description_idx
    ON public.product (description, prodcode)
    WHERE NOT is_deleted;
