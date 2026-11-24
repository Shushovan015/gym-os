# Proposal A — Urgent production privilege correction

For separate approval on project `akhbjjggcftyzlunrxwk`. The supplied metadata report identifies PostgreSQL 17.11. It shows RLS disabled and direct anonymous write grants on `shop_items`, `shop_page_content`, `facilities_page_content`, and `pricing_page_content`. No production write test was performed.

## A1. Preserve public reads and remove anonymous table writes

The [exact ACL correction](../scripts/propose-restrict-anon-catalog-writes.sql) replaces direct `anon` table privileges on those four tables with `SELECT`. The transaction aborts if any effective anonymous write, column-write, trigger, reference, truncation or maintenance privilege remains. It leaves RLS and other roles' grants intact.

Before executing, have the operator capture the four current table and column ACLs with grantors and grant options. Confirm they still match the reviewed report and review dependencies. The existing frontend reads public catalog and page content. Studio writes use an authenticated session. After commit, verify anonymous SELECT access, effective denial of writes, and the intended authenticated Studio path. Verify effective permissions through ACL checks and disposable fixtures. Keep production records unchanged during validation.

This closes the direct anonymous table path. Since RLS is disabled and `authenticated` also holds write grants, users with an ordinary signed-in session may still have table write access. Close that path separately with tested administrator write policies and appropriate grants after identifying other signed-in consumers. Existing public reads include whatever columns and rows the existing tables expose.

Before commit, a failed guard rolls back all ACL changes. After commit, if the captured ACL matches the reviewed CSV exactly and rollback is approved, its four direct grants were all table privileges without grant option. Restore them as the original grantor. Rollback restores the vulnerability, so prefer fixing any verified caller's role assignment.

```sql
BEGIN;
GRANT ALL PRIVILEGES ON TABLE public.shop_items, public.shop_page_content,
  public.facilities_page_content, public.pricing_page_content TO anon;
COMMIT;
```

## A2. Close the exposed invoice recalculation routine

Use the [SELECT-only A2 inspection](../scripts/review-invoice-recalculation.sql) in the verified project's SQL Editor before considering the revocation. Review the returned function definitions privately and redact any embedded secrets before sharing results. The projected EXECUTE column models removal of the three named ACL entries. It does not model dependent grants or replace an owner review. Catalog dependencies and stored-body matches can miss dynamic calls, external callers, and indirect paths. Confirm active application and operator callers separately.

The checked-in internal callers are `finalize_invoice` and `record_invoice_payment`, including their later migration definitions. Confirm each live caller remains SECURITY DEFINER and its owner retains EXECUTE after the proposed revokes, or identify the effective invoking role for any SECURITY INVOKER path. Compare both current and projected privileges for the service role and confirm any direct service caller is authorized. A staging billing check is needed before approval because catalog results alone cannot verify the complete workflow.

The CSV reports `PUBLIC`, `anon`, `authenticated`, and `service_role` EXECUTE on `public.recalculate_invoice_payment_state(bigint)`. The checked-in body updates invoice balances and status and contains no caller authorization check. This is a potential write path independent of the four table ACLs. The current routine body and PostgREST exposure require owner verification. Existing checked-in invoice RPCs invoke it internally as their definer. No direct frontend or Edge Function caller was found in the checked-in tree.

After reviewing the live body, owner, grants and dependencies, and separately approving this substep, remove the three client-facing grants. Preserve owner and service-role execution subject to confirming their legitimate use. Validate that existing admin billing RPCs still work in staging. If inherited client EXECUTE persists, roll back the transaction and investigate its origin.

```sql
BEGIN;
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_payment_state(bigint)
  FROM PUBLIC, anon, authenticated RESTRICT;
DO $check$
BEGIN
  IF has_function_privilege('anon','public.recalculate_invoice_payment_state(bigint)','EXECUTE')
     OR has_function_privilege('authenticated','public.recalculate_invoice_payment_state(bigint)','EXECUTE')
  THEN RAISE EXCEPTION 'Client EXECUTE remains'; END IF;
END;
$check$;
COMMIT;
```

After approval, rollback can restore the three exact captured no-grant-option entries as the original grantor using `GRANT EXECUTE ON FUNCTION public.recalculate_invoice_payment_state(bigint) TO PUBLIC, anon, authenticated;`. This reopens the write path. Roll back only with a specific dependency finding and a mitigation plan.
