-- The masked products view writes through a SECURITY DEFINER trigger, so the
-- products_base RLS WITH CHECK policy is not the only enforcement boundary.
-- Enforce the same plan cap for every non-service insert and serialize inserts
-- per organization so concurrent imports cannot exceed the limit.

-- This count is consulted after the per-organization transaction lock. VOLATILE
-- gives each policy/trigger invocation a fresh snapshot, including successive
-- rows in a bulk insert.
ALTER FUNCTION public.org_can_add_product(uuid) VOLATILE;

-- These tenant-scoped operational views and their backing tables are only
-- intended for authenticated shop members and trusted server-side services.
REVOKE ALL ON public.ac_jobs, public.contractors, public.job_items,
  public.products, public.sale_lines, public.sales, public.technicians,
  public.vehicles
  FROM anon;
REVOKE ALL ON public.job_items_base, public.technicians_base FROM anon;

CREATE OR REPLACE FUNCTION public.enforce_product_plan_limit_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Shop provisioning uses the server-only service role to seed its templates.
  -- Database migrations and trusted database administration are also exempt.
  IF auth.role() = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization is required to add a product'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.organization_id::text, 20261121)
  );

  IF NOT public.org_can_add_product(NEW.organization_id) THEN
    RAISE EXCEPTION 'product limit reached for organization'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_product_plan_limit_before_insert()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS products_base_enforce_plan_limit
  ON public.products_base;
CREATE TRIGGER products_base_enforce_plan_limit
  BEFORE INSERT ON public.products_base
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_plan_limit_before_insert();

COMMENT ON FUNCTION public.enforce_product_plan_limit_before_insert() IS
  'Enforces organization product limits under a per-organization transaction lock for authenticated inserts, including SECURITY DEFINER masked-view writes.';

