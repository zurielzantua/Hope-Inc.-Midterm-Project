-- S2-DBA-02: current product price for a supplied effective date.
CREATE FUNCTION public.product_price_as_of(
    p_prod_code varchar(6),
    p_as_of date
)
RETURNS numeric
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $function$
    SELECT ph.unitprice
      FROM public.pricehist_active AS ph
     WHERE ph.prodcode = p_prod_code
       AND ph.effdate <= p_as_of
     ORDER BY ph.effdate DESC
     LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.product_price_as_of(character varying, date)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_price_as_of(character varying, date)
    TO service_role;
