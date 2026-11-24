-- Run manually in the verified Supabase Dashboard SQL Editor.
-- One SELECT. No routine invocation, billing rows, or permission changes.
WITH target AS (
  SELECT p.* FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure('public.recalculate_invoice_payment_state(bigint)')
), acl AS (
  SELECT a.* FROM target t CROSS JOIN LATERAL pg_catalog.aclexplode(
    coalesce(t.proacl, pg_catalog.acldefault('f',t.proowner))) a
  WHERE a.privilege_type = 'EXECUTE'
), callers AS (
  SELECT p.*, n.nspname
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  JOIN target t ON t.oid <> p.oid
  WHERE p.prokind IN ('f','p') AND (strpos(lower(p.prosrc), t.proname::text) > 0 OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_depend d
    WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
      AND d.refclassid = 'pg_proc'::regclass AND d.refobjid = t.oid
  ))
), principals AS (
  SELECT rolname, oid FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon','authenticated','service_role','authenticator','gym_export_login','gym_export_reader')
     OR oid IN (SELECT proowner FROM target UNION SELECT proowner FROM callers)
), report AS (
  SELECT '01_target' AS section, 'public.recalculate_invoice_payment_state(bigint)'::text AS object_name,
    jsonb_build_object('exists',t.oid IS NOT NULL,'owner',pg_get_userbyid(t.proowner),
      'securityDefiner',t.prosecdef,'configuration',t.proconfig,
      'definition',pg_get_functiondef(t.oid)) AS details
  FROM (SELECT 1) anchor LEFT JOIN target t ON true
  UNION ALL
  SELECT '02_execute_acl', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
    jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantOption',a.is_grantable)
  FROM acl a
  UNION ALL
  SELECT '03_effective_access', p.rolname::text, jsonb_build_object(
    'schemaUsage',has_schema_privilege(p.oid,t.pronamespace,'USAGE'),
    'currentExecute',has_function_privilege(p.oid,t.oid,'EXECUTE'),
    'executeAfterProposedRevokes',p.oid = t.proowner OR r.rolsuper OR EXISTS (
      SELECT 1 FROM acl a JOIN pg_catalog.pg_roles g ON g.oid = a.grantee
      WHERE g.rolname NOT IN ('anon','authenticated') AND pg_has_role(p.oid,g.oid,'USAGE')))
  FROM principals p JOIN pg_catalog.pg_roles r ON r.oid = p.oid CROSS JOIN target t
  UNION ALL
  SELECT '04_caller_candidate', format('%I.%I(%s)',c.nspname,c.proname,oidvectortypes(c.proargtypes)),
    jsonb_build_object('owner',pg_get_userbyid(c.proowner),'securityDefiner',c.prosecdef,
      'currentOwnerExecute',has_function_privilege(c.proowner,t.oid,'EXECUTE'),
      'anonCanExecuteCaller',has_function_privilege(to_regrole('anon'),c.oid,'EXECUTE'),
      'authenticatedCanExecuteCaller',has_function_privilege(to_regrole('authenticated'),c.oid,'EXECUTE'),
      'serviceRoleCanExecuteCaller',has_function_privilege(to_regrole('service_role'),c.oid,'EXECUTE'),
      'definition',pg_get_functiondef(c.oid))
  FROM callers c CROSS JOIN target t
  UNION ALL
  SELECT '05_tracked_dependency', pg_describe_object(d.classid,d.objid,d.objsubid),
    jsonb_build_object('direction','dependent on target','type',d.deptype)
  FROM target t JOIN pg_catalog.pg_depend d ON d.refclassid = 'pg_proc'::regclass AND d.refobjid = t.oid
  UNION ALL
  SELECT '05_tracked_dependency', pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),
    jsonb_build_object('direction','target depends on object','type',d.deptype)
  FROM target t JOIN pg_catalog.pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = t.oid
)
SELECT section, object_name, details FROM report ORDER BY section, object_name, details;
