-- S2-DBA-06: support measured product/date price lookup and a set-based list RPC.
CREATE INDEX pricehist_active_prod_effdate_unitprice_idx
    ON public.pricehist (prodcode, effdate DESC)
    INCLUDE (unitprice)
    WHERE NOT is_deleted;

CREATE FUNCTION public.product_prices_as_of(
    p_prod_codes varchar(6)[],
    p_as_of date
)
RETURNS TABLE (prodcode varchar(6), unitprice numeric)
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $function$
    SELECT requested.prodcode,
           latest.unitprice
      FROM (
          SELECT DISTINCT input.prodcode
            FROM pg_catalog.unnest(p_prod_codes) AS input(prodcode)
      ) AS requested
      CROSS JOIN LATERAL (
          SELECT ph.unitprice
            FROM public.pricehist_active AS ph
           WHERE ph.prodcode = requested.prodcode
             AND ph.effdate <= p_as_of
           ORDER BY ph.effdate DESC
           LIMIT 1
      ) AS latest;
$function$;

REVOKE ALL ON FUNCTION public.product_prices_as_of(character varying[], date)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_prices_as_of(character varying[], date)
    TO service_role;
