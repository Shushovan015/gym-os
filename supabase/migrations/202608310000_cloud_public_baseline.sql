


-- Read-only schema export from the existing Supabase Cloud public schema.
-- Contains structure, functions, grants, and RLS policies; no production rows.
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" bigint NOT NULL,
    "invoice_number" "text",
    "member_ref" bigint,
    "customer_name" "text" NOT NULL,
    "customer_phone" "text",
    "customer_email" "text",
    "billing_date" "date" DEFAULT ("timezone"('Asia/Kathmandu'::"text", "now"()))::"date" NOT NULL,
    "due_date" "date",
    "invoice_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "currency_code" "text" DEFAULT 'NPR'::"text" NOT NULL,
    "subtotal_minor" bigint DEFAULT 0 NOT NULL,
    "discount_minor" bigint DEFAULT 0 NOT NULL,
    "tax_minor" bigint DEFAULT 0 NOT NULL,
    "total_minor" bigint DEFAULT 0 NOT NULL,
    "paid_minor" bigint DEFAULT 0 NOT NULL,
    "balance_minor" bigint DEFAULT 0 NOT NULL,
    "tax_enabled" boolean DEFAULT false NOT NULL,
    "tax_label" "text" DEFAULT 'Tax'::"text" NOT NULL,
    "tax_rate_basis_points" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "inventory_applied_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "cancelled_by" "uuid",
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_amounts_check" CHECK ((("invoice_status" = 'draft'::"text") OR (("discount_minor" <= "subtotal_minor") AND ("total_minor" = (("subtotal_minor" - "discount_minor") + "tax_minor")) AND ("paid_minor" <= "total_minor") AND ("balance_minor" = ("total_minor" - "paid_minor"))))),
    CONSTRAINT "invoices_balance_minor_check" CHECK (("balance_minor" >= 0)),
    CONSTRAINT "invoices_discount_minor_check" CHECK (("discount_minor" >= 0)),
    CONSTRAINT "invoices_invoice_status_check" CHECK (("invoice_status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "invoices_paid_minor_check" CHECK (("paid_minor" >= 0)),
    CONSTRAINT "invoices_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'partially_paid'::"text", 'paid'::"text"]))),
    CONSTRAINT "invoices_subtotal_minor_check" CHECK (("subtotal_minor" >= 0)),
    CONSTRAINT "invoices_tax_minor_check" CHECK (("tax_minor" >= 0)),
    CONSTRAINT "invoices_tax_rate_basis_points_check" CHECK ((("tax_rate_basis_points" >= 0) AND ("tax_rate_basis_points" <= 10000))),
    CONSTRAINT "invoices_total_minor_check" CHECK (("total_minor" >= 0))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_invoice"("p_invoice_id" bigint, "p_reason" "text") RETURNS "public"."invoices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invoice public.invoices; v_move record; v_variant public.inventory_product_variants;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.invoice_status='cancelled' then return v_invoice; end if;
  if v_invoice.invoice_status<>'issued' then raise exception 'Only issued invoices can be cancelled'; end if;
  for v_move in select * from public.stock_movements where invoice_id=p_invoice_id and movement_type='sale' order by variant_id loop
    select * into v_variant from public.inventory_product_variants where id=v_move.variant_id for update;
    if not exists(select 1 from public.stock_movements where invoice_id=p_invoice_id and variant_id=v_move.variant_id and movement_type='cancellation_reversal') then
      update public.inventory_product_variants set current_quantity=current_quantity+abs(v_move.quantity_delta) where id=v_move.variant_id;
      insert into public.stock_movements(variant_id,movement_type,quantity_delta,previous_quantity,resulting_quantity,invoice_id,reference,notes)
      values(v_move.variant_id,'cancellation_reversal',abs(v_move.quantity_delta),v_variant.current_quantity,v_variant.current_quantity+abs(v_move.quantity_delta),p_invoice_id,'Invoice cancellation',p_reason);
    end if;
  end loop;
  update public.invoices set invoice_status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=nullif(trim(p_reason),''),updated_by=auth.uid() where id=p_invoice_id returning * into v_invoice;
  return v_invoice;
end $$;


ALTER FUNCTION "public"."cancel_invoice"("p_invoice_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint DEFAULT 0, "p_payment_method" "text" DEFAULT 'cash'::"text", "p_payment_reference" "text" DEFAULT NULL::"text") RETURNS "public"."invoices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invoice public.invoices; v_item record; v_variant public.inventory_product_variants; v_subtotal bigint; v_tax bigint; v_total bigint; v_seq bigint; v_prefix text; v_allow_negative boolean; v_last_item_id bigint;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.invoice_status <> 'draft' then raise exception 'Only draft invoices can be issued'; end if;
  select coalesce(sum(round(quantity * unit_price_minor)),0)::bigint into v_subtotal from public.invoice_items where invoice_id=p_invoice_id;
  if not exists(select 1 from public.invoice_items where invoice_id=p_invoice_id) then raise exception 'Invoice must contain at least one item'; end if;
  if v_invoice.discount_minor > v_subtotal then raise exception 'Discount exceeds invoice subtotal'; end if;
  v_tax := case when v_invoice.tax_enabled then round(((v_subtotal-v_invoice.discount_minor)::numeric*v_invoice.tax_rate_basis_points)/10000)::bigint else 0 end;
  v_total := v_subtotal - v_invoice.discount_minor + v_tax;
  if v_total < 0 then raise exception 'Discount exceeds invoice subtotal'; end if;
  if p_payment_amount_minor < 0 or p_payment_amount_minor > v_total then raise exception 'Invalid payment amount'; end if;
  select invoice_prefix,allow_negative_stock into v_prefix,v_allow_negative from public.admin_settings where id=1;
  insert into public.invoice_number_sequences(sequence_year,last_number) values(extract(year from v_invoice.billing_date)::int,1)
  on conflict(sequence_year) do update set last_number=public.invoice_number_sequences.last_number+1,updated_at=now() returning last_number into v_seq;
  for v_item in select * from public.invoice_items where invoice_id=p_invoice_id and item_type='product' order by variant_id loop
    select * into v_variant from public.inventory_product_variants where id=v_item.variant_id for update;
    if not found or not v_variant.is_active then raise exception 'Product variant is unavailable'; end if;
    if not coalesce(v_allow_negative,false) and v_variant.current_quantity < v_item.quantity then raise exception 'Insufficient stock for %',v_item.description; end if;
    update public.inventory_product_variants set current_quantity=current_quantity-v_item.quantity where id=v_item.variant_id;
    insert into public.stock_movements(variant_id,movement_type,quantity_delta,previous_quantity,resulting_quantity,invoice_id,reference)
    values(v_item.variant_id,'sale',-v_item.quantity,v_variant.current_quantity,v_variant.current_quantity-v_item.quantity,p_invoice_id,'Invoice sale');
  end loop;
  update public.invoice_items set tax_minor=0,line_total_minor=round(quantity*unit_price_minor)::bigint-discount_minor where invoice_id=p_invoice_id;
  select id into v_last_item_id from public.invoice_items where invoice_id=p_invoice_id order by sort_order desc,id desc limit 1;
  update public.invoice_items set tax_minor=v_tax,line_total_minor=line_total_minor+v_tax where id=v_last_item_id;
  update public.invoices set invoice_number=v_prefix||'-'||extract(year from billing_date)::int||'-'||lpad(v_seq::text,6,'0'),invoice_status='issued',subtotal_minor=v_subtotal,tax_minor=v_tax,total_minor=v_total,balance_minor=v_total,inventory_applied_at=now(),updated_by=auth.uid() where id=p_invoice_id;
  if p_payment_amount_minor > 0 then
    if p_payment_method not in ('cash','card','bank_transfer','digital_wallet','other') then raise exception 'Invalid payment method'; end if;
    insert into public.invoice_payments(invoice_id,amount_minor,payment_method,reference) values(p_invoice_id,p_payment_amount_minor,p_payment_method,p_payment_reference);
  end if;
  perform public.recalculate_invoice_payment_state(p_invoice_id);
  update public.members m set payment_status=case when i.payment_status='paid' then 'paid' else 'unpaid' end,payment_due_date=case when i.payment_status='paid' then null else i.due_date end
  from public.invoices i where i.id=p_invoice_id and i.member_ref=m.id and exists(select 1 from public.invoice_items x where x.invoice_id=i.id and x.item_type='membership');
  select * into v_invoice from public.invoices where id=p_invoice_id; return v_invoice;
end $$;


ALTER FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint, "p_payment_method" "text", "p_payment_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') $$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_invoice_payment_state"("p_invoice_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_paid bigint; v_total bigint;
begin
  select total_minor into v_total from public.invoices where id=p_invoice_id for update;
  select coalesce(sum(case when is_reversal then -amount_minor else amount_minor end),0) into v_paid from public.invoice_payments where invoice_id=p_invoice_id;
  if v_paid < 0 or v_paid > v_total then raise exception 'Payment total is outside invoice balance'; end if;
  update public.invoices set paid_minor=v_paid,balance_minor=v_total-v_paid,
    payment_status=case when v_paid=0 then 'unpaid' when v_paid<v_total then 'partially_paid' else 'paid' end,
    updated_by=auth.uid() where id=p_invoice_id;
end $$;


ALTER FUNCTION "public"."recalculate_invoice_payment_state"("p_invoice_id" bigint) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_payments" (
    "id" bigint NOT NULL,
    "invoice_id" bigint NOT NULL,
    "amount_minor" bigint NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_date" "date" DEFAULT ("timezone"('Asia/Kathmandu'::"text", "now"()))::"date" NOT NULL,
    "reference" "text",
    "notes" "text",
    "is_reversal" boolean DEFAULT false NOT NULL,
    "reverses_payment_id" bigint,
    "received_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_payments_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "invoice_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'card'::"text", 'bank_transfer'::"text", 'digital_wallet'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."invoice_payments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_invoice_payment"("p_invoice_id" bigint, "p_amount_minor" bigint, "p_payment_method" "text", "p_payment_date" "date" DEFAULT NULL::"date", "p_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."invoice_payments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invoice public.invoices; v_payment public.invoice_payments;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found or v_invoice.invoice_status<>'issued' then raise exception 'Only issued invoices can receive payments'; end if;
  if p_amount_minor<=0 or p_amount_minor>v_invoice.balance_minor then raise exception 'Payment exceeds outstanding balance'; end if;
  if p_payment_method not in ('cash','card','bank_transfer','digital_wallet','other') then raise exception 'Invalid payment method'; end if;
  insert into public.invoice_payments(invoice_id,amount_minor,payment_method,payment_date,reference,notes)
  values(p_invoice_id,p_amount_minor,p_payment_method,coalesce(p_payment_date,(timezone('Asia/Kathmandu',now()))::date),p_reference,p_notes) returning * into v_payment;
  perform public.recalculate_invoice_payment_state(p_invoice_id);
  update public.members m set payment_status=case when i.payment_status='paid' then 'paid' else 'unpaid' end,payment_due_date=case when i.payment_status='paid' then null else i.due_date end
  from public.invoices i where i.id=p_invoice_id and i.member_ref=m.id and exists(select 1 from public.invoice_items x where x.invoice_id=i.id and x.item_type='membership');
  return v_payment;
end $$;


ALTER FUNCTION "public"."record_invoice_payment"("p_invoice_id" bigint, "p_amount_minor" bigint, "p_payment_method" "text", "p_payment_date" "date", "p_reference" "text", "p_notes" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" bigint NOT NULL,
    "variant_id" bigint NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity_delta" numeric(14,3) NOT NULL,
    "previous_quantity" numeric(14,3) NOT NULL,
    "resulting_quantity" numeric(14,3) NOT NULL,
    "supplier_id" bigint,
    "invoice_id" bigint,
    "reference" "text",
    "notes" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['opening'::"text", 'purchase'::"text", 'sale'::"text", 'manual_increase'::"text", 'manual_decrease'::"text", 'damaged'::"text", 'return'::"text", 'correction'::"text", 'cancellation_reversal'::"text"]))),
    CONSTRAINT "stock_movements_quantity_delta_check" CHECK (("quantity_delta" <> (0)::numeric))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_stock_movement"("p_variant_id" bigint, "p_movement_type" "text", "p_quantity_delta" numeric, "p_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_supplier_id" bigint DEFAULT NULL::bigint) RETURNS "public"."stock_movements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_variant public.inventory_product_variants; v_result public.stock_movements; v_allow_negative boolean;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_quantity_delta = 0 then raise exception 'Quantity change cannot be zero'; end if;
  if p_movement_type not in ('opening','purchase','manual_increase','manual_decrease','damaged','return','correction') then raise exception 'Invalid manual stock movement type'; end if;
  select * into v_variant from public.inventory_product_variants where id = p_variant_id for update;
  if not found then raise exception 'Variant not found'; end if;
  select allow_negative_stock into v_allow_negative from public.admin_settings where id = 1;
  if not coalesce(v_allow_negative, false) and v_variant.current_quantity + p_quantity_delta < 0 then raise exception 'Insufficient stock'; end if;
  update public.inventory_product_variants set current_quantity = current_quantity + p_quantity_delta where id = p_variant_id;
  insert into public.stock_movements(variant_id,movement_type,quantity_delta,previous_quantity,resulting_quantity,supplier_id,reference,notes)
  values(p_variant_id,p_movement_type,p_quantity_delta,v_variant.current_quantity,v_variant.current_quantity+p_quantity_delta,p_supplier_id,p_reference,p_notes) returning * into v_result;
  return v_result;
end $$;


ALTER FUNCTION "public"."record_stock_movement"("p_variant_id" bigint, "p_movement_type" "text", "p_quantity_delta" numeric, "p_reference" "text", "p_notes" "text", "p_supplier_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_admin_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_admin_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_attendance_holidays_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_attendance_holidays_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_attendance_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_attendance_records_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_inventory_billing_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "public"."set_inventory_billing_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_members_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_members_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "gym_name" "text" DEFAULT 'A&A Health Club'::"text" NOT NULL,
    "logo_url" "text",
    "phone" "text" DEFAULT '+977 98XXXXXXXX'::"text" NOT NULL,
    "email" "text" DEFAULT 'info@aahealthclub.com'::"text" NOT NULL,
    "address" "text" DEFAULT 'Butwal, Rupandehi, Nepal'::"text" NOT NULL,
    "operating_hours" "text" DEFAULT 'Daily, 5:00 AM - 9:00 PM'::"text" NOT NULL,
    "weekly_closing_day" integer DEFAULT 6 NOT NULL,
    "expiry_warning_days" integer DEFAULT 7 NOT NULL,
    "absent_after_days" integer DEFAULT 8 NOT NULL,
    "default_membership_type" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "date_display_preference" "text" DEFAULT 'both'::"text" NOT NULL,
    "attendance_holiday_lock" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invoice_prefix" "text" DEFAULT 'GYM'::"text" NOT NULL,
    "currency_code" "text" DEFAULT 'NPR'::"text" NOT NULL,
    "currency_minor_unit" smallint DEFAULT 2 NOT NULL,
    "tax_enabled" boolean DEFAULT false NOT NULL,
    "tax_label" "text" DEFAULT 'Tax'::"text" NOT NULL,
    "tax_rate_basis_points" integer DEFAULT 0 NOT NULL,
    "pan_vat_number" "text",
    "receipt_footer" "text" DEFAULT 'Thank you for choosing us.'::"text" NOT NULL,
    "allow_negative_stock" boolean DEFAULT false NOT NULL,
    CONSTRAINT "admin_settings_absent_after_days_check" CHECK ((("absent_after_days" >= 1) AND ("absent_after_days" <= 60))),
    CONSTRAINT "admin_settings_currency_check" CHECK (("currency_code" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "admin_settings_date_display_preference_check" CHECK (("date_display_preference" = ANY (ARRAY['bs'::"text", 'ad'::"text", 'both'::"text"]))),
    CONSTRAINT "admin_settings_default_membership_type_check" CHECK (("default_membership_type" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'yearly'::"text", 'trial'::"text"]))),
    CONSTRAINT "admin_settings_expiry_warning_days_check" CHECK (("expiry_warning_days" = ANY (ARRAY[7, 15, 30]))),
    CONSTRAINT "admin_settings_id_check" CHECK (("id" = 1)),
    CONSTRAINT "admin_settings_invoice_prefix_check" CHECK (("invoice_prefix" ~ '^[A-Z0-9-]{1,12}$'::"text")),
    CONSTRAINT "admin_settings_tax_rate_check" CHECK ((("tax_rate_basis_points" >= 0) AND ("tax_rate_basis_points" <= 10000))),
    CONSTRAINT "admin_settings_weekly_closing_day_check" CHECK ((("weekly_closing_day" >= 0) AND ("weekly_closing_day" <= 6)))
);


ALTER TABLE "public"."admin_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_holidays" (
    "id" bigint NOT NULL,
    "holiday_date" "date" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance_holidays" OWNER TO "postgres";


ALTER TABLE "public"."attendance_holidays" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."attendance_holidays_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."attendance_records" (
    "id" bigint NOT NULL,
    "member_ref" bigint NOT NULL,
    "attendance_date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "check_in_time" time without time zone,
    "check_out_time" time without time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "attendance_records_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'late'::"text", 'absent'::"text", 'excused'::"text"]))),
    CONSTRAINT "attendance_records_time_order" CHECK ((("check_in_time" IS NULL) OR ("check_out_time" IS NULL) OR ("check_out_time" >= "check_in_time")))
);


ALTER TABLE "public"."attendance_records" OWNER TO "postgres";


ALTER TABLE "public"."attendance_records" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."attendance_records_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."contact_content" (
    "id" integer NOT NULL,
    "hero_badge" "text" DEFAULT ''::"text" NOT NULL,
    "hero_title" "text" DEFAULT ''::"text" NOT NULL,
    "hero_description" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "hours" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "map_embed_url" "text" DEFAULT ''::"text" NOT NULL,
    "visit_text" "text" DEFAULT ''::"text" NOT NULL,
    "cta_primary_text" "text" DEFAULT ''::"text" NOT NULL,
    "cta_primary_link" "text" DEFAULT '/pricing'::"text" NOT NULL,
    "cta_secondary_text" "text" DEFAULT ''::"text" NOT NULL,
    "cta_secondary_link" "text" DEFAULT '/trainers'::"text" NOT NULL,
    "form_note" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hero_image" "text",
    "summary_cards" "jsonb" DEFAULT '[]'::"jsonb",
    "info_title" "text",
    "info_description" "text",
    "form_title" "text",
    "form_description" "text",
    "form_button_text" "text",
    "faq_title" "text",
    "faq_description" "text",
    "bottom_cta_title" "text",
    "bottom_cta_description" "text",
    "bottom_primary_cta_text" "text",
    "bottom_primary_cta_link" "text",
    "bottom_secondary_cta_text" "text",
    "bottom_secondary_cta_link" "text"
);


ALTER TABLE "public"."contact_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_faqs" (
    "id" bigint NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_faqs" OWNER TO "postgres";


ALTER TABLE "public"."contact_faqs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."contact_faqs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."facilities_page_content" (
    "id" integer NOT NULL,
    "hero_badge" "text",
    "hero_title" "text",
    "hero_description" "text",
    "hero_primary_cta_text" "text",
    "hero_primary_cta_link" "text",
    "hero_secondary_cta_text" "text",
    "hero_secondary_cta_link" "text",
    "summary_cards" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "zone_explorer_title" "text",
    "zone_explorer_description" "text",
    "amenities_title" "text",
    "amenities_description" "text",
    "tour_title" "text",
    "tour_description" "text",
    "tour_primary_cta_text" "text",
    "tour_primary_cta_link" "text",
    "tour_secondary_cta_text" "text",
    "tour_secondary_cta_link" "text"
);


ALTER TABLE "public"."facilities_page_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facility_items" (
    "id" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "tag" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "facility_items_kind_check" CHECK (("kind" = ANY (ARRAY['zone'::"text", 'amenity'::"text"])))
);


ALTER TABLE "public"."facility_items" OWNER TO "postgres";


ALTER TABLE "public"."facility_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."facility_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."footer_content" (
    "id" integer NOT NULL,
    "brand_name" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "banner_title" "text" DEFAULT ''::"text" NOT NULL,
    "banner_subtitle" "text" DEFAULT ''::"text" NOT NULL,
    "cta_text" "text" DEFAULT ''::"text" NOT NULL,
    "cta_link" "text" DEFAULT '/contact'::"text" NOT NULL,
    "about_text" "text" DEFAULT ''::"text" NOT NULL,
    "hours_text" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "copyright_text" "text" DEFAULT ''::"text" NOT NULL,
    "bottom_tags" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."footer_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."home_content" (
    "id" integer NOT NULL,
    "hero_badge" "text" DEFAULT ''::"text" NOT NULL,
    "hero_title" "text" DEFAULT ''::"text" NOT NULL,
    "hero_description" "text" DEFAULT ''::"text" NOT NULL,
    "hero_image" "text" DEFAULT ''::"text" NOT NULL,
    "hero_primary_cta_text" "text" DEFAULT ''::"text" NOT NULL,
    "hero_primary_cta_link" "text" DEFAULT '/contact'::"text" NOT NULL,
    "hero_secondary_cta_text" "text" DEFAULT ''::"text" NOT NULL,
    "hero_secondary_cta_link" "text" DEFAULT '/pricing'::"text" NOT NULL,
    "status_title" "text" DEFAULT ''::"text" NOT NULL,
    "zones_title" "text" DEFAULT ''::"text" NOT NULL,
    "coaches_title" "text" DEFAULT ''::"text" NOT NULL,
    "coaches_subtitle" "text" DEFAULT ''::"text" NOT NULL,
    "maximus_badge" "text" DEFAULT ''::"text" NOT NULL,
    "maximus_title" "text" DEFAULT ''::"text" NOT NULL,
    "maximus_description" "text" DEFAULT ''::"text" NOT NULL,
    "maximus_image" "text" DEFAULT ''::"text" NOT NULL,
    "maximus_learn_more_link" "text" DEFAULT '/about#maximus-strength'::"text" NOT NULL,
    "maximus_instagram_link" "text" DEFAULT ''::"text" NOT NULL,
    "testimonials_title" "text" DEFAULT ''::"text" NOT NULL,
    "testimonials_subtitle" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hero_metrics" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "gallery_title" "text",
    "gallery_images" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "final_cta_title" "text",
    "final_cta_description" "text",
    "final_primary_cta_text" "text",
    "final_primary_cta_link" "text",
    "final_secondary_cta_text" "text",
    "final_secondary_cta_link" "text"
);


ALTER TABLE "public"."home_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."home_maximus_points" (
    "id" bigint NOT NULL,
    "point" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."home_maximus_points" OWNER TO "postgres";


ALTER TABLE "public"."home_maximus_points" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."home_maximus_points_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."home_status_items" (
    "id" bigint NOT NULL,
    "label" "text" NOT NULL,
    "value" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."home_status_items" OWNER TO "postgres";


ALTER TABLE "public"."home_status_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."home_status_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_product_variants" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "name" "text" DEFAULT 'Default'::"text" NOT NULL,
    "sku" "text" NOT NULL,
    "barcode" "text",
    "size" "text",
    "color" "text",
    "flavour" "text",
    "package_size" "text",
    "cost_price_minor" bigint,
    "selling_price_minor" bigint,
    "current_quantity" numeric(14,3) DEFAULT 0 NOT NULL,
    "low_stock_threshold" numeric(14,3),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_variant_money_check" CHECK (((COALESCE("cost_price_minor", (0)::bigint) >= 0) AND (COALESCE("selling_price_minor", (0)::bigint) >= 0))),
    CONSTRAINT "inventory_variant_threshold_check" CHECK ((COALESCE("low_stock_threshold", (0)::numeric) >= (0)::numeric))
);


ALTER TABLE "public"."inventory_product_variants" OWNER TO "postgres";


ALTER TABLE "public"."inventory_product_variants" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_product_variants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_suppliers" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_suppliers" OWNER TO "postgres";


ALTER TABLE "public"."inventory_suppliers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_suppliers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" bigint NOT NULL,
    "invoice_id" bigint NOT NULL,
    "item_type" "text" NOT NULL,
    "product_id" bigint,
    "variant_id" bigint,
    "source_item_id" bigint,
    "description" "text" NOT NULL,
    "quantity" numeric(14,3) NOT NULL,
    "unit_price_minor" bigint NOT NULL,
    "discount_minor" bigint DEFAULT 0 NOT NULL,
    "tax_minor" bigint DEFAULT 0 NOT NULL,
    "line_total_minor" bigint NOT NULL,
    "membership_period_start" "date",
    "membership_period_end" "date",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_item_product_check" CHECK ((("item_type" <> 'product'::"text") OR (("product_id" IS NOT NULL) AND ("variant_id" IS NOT NULL)))),
    CONSTRAINT "invoice_items_discount_minor_check" CHECK (("discount_minor" >= 0)),
    CONSTRAINT "invoice_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['membership'::"text", 'personal_training'::"text", 'product'::"text", 'miscellaneous'::"text"]))),
    CONSTRAINT "invoice_items_line_total_minor_check" CHECK (("line_total_minor" >= 0)),
    CONSTRAINT "invoice_items_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "invoice_items_tax_minor_check" CHECK (("tax_minor" >= 0)),
    CONSTRAINT "invoice_items_unit_price_minor_check" CHECK (("unit_price_minor" >= 0))
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


ALTER TABLE "public"."invoice_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."invoice_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."invoice_number_sequences" (
    "sequence_year" integer NOT NULL,
    "last_number" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_number_sequences_last_number_check" CHECK (("last_number" >= 0))
);


ALTER TABLE "public"."invoice_number_sequences" OWNER TO "postgres";


ALTER TABLE "public"."invoice_payments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."invoice_payments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."invoices" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."invoices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."member_measurements" (
    "id" bigint NOT NULL,
    "member_ref" bigint NOT NULL,
    "recorded_at" "date" NOT NULL,
    "weight_kg" numeric(6,2),
    "body_fat_percent" numeric(5,2),
    "chest_cm" numeric(6,2),
    "waist_cm" numeric(6,2),
    "hips_cm" numeric(6,2),
    "arm_cm" numeric(6,2),
    "thigh_cm" numeric(6,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member_measurements" OWNER TO "postgres";


ALTER TABLE "public"."member_measurements" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."member_measurements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."member_report_logs" (
    "id" bigint NOT NULL,
    "member_ref" bigint NOT NULL,
    "recipient_email" "text",
    "status" "text" NOT NULL,
    "error_message" "text",
    "sent_by" "uuid",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "member_report_logs_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."member_report_logs" OWNER TO "postgres";


ALTER TABLE "public"."member_report_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."member_report_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."member_transformations" (
    "id" bigint NOT NULL,
    "member_ref" bigint NOT NULL,
    "captured_at" "date" NOT NULL,
    "milestone_title" "text",
    "milestone_notes" "text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member_transformations" OWNER TO "postgres";


ALTER TABLE "public"."member_transformations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."member_transformations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" bigint NOT NULL,
    "member_id" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text" NOT NULL,
    "membership_type" "text" NOT NULL,
    "membership_status" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "last_visit_date" "date",
    "payment_status" "text" NOT NULL,
    "payment_due_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "members_membership_status_check" CHECK (("membership_status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "members_membership_type_check" CHECK (("membership_type" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'yearly'::"text", 'trial'::"text"]))),
    CONSTRAINT "members_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['paid'::"text", 'unpaid'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."members" OWNER TO "postgres";


ALTER TABLE "public"."members" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."members_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."personal_training_plans" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "details" "text" DEFAULT ''::"text" NOT NULL,
    "points" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."personal_training_plans" OWNER TO "postgres";


ALTER TABLE "public"."personal_training_plans" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."personal_training_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pricing_items" (
    "id" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "price" "text" DEFAULT ''::"text" NOT NULL,
    "cadence" "text" DEFAULT ''::"text" NOT NULL,
    "subtitle" "text" DEFAULT ''::"text" NOT NULL,
    "is_highlighted" boolean DEFAULT false NOT NULL,
    "features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_items_kind_check" CHECK (("kind" = ANY (ARRAY['plan'::"text", 'perk'::"text"])))
);


ALTER TABLE "public"."pricing_items" OWNER TO "postgres";


ALTER TABLE "public"."pricing_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pricing_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pricing_page_content" (
    "id" integer NOT NULL,
    "hero_badge" "text",
    "hero_title" "text",
    "hero_description" "text",
    "hero_primary_cta_text" "text",
    "hero_primary_cta_link" "text",
    "hero_secondary_cta_text" "text",
    "hero_secondary_cta_link" "text",
    "summary_cards" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "benefits_title" "text",
    "benefits_description" "text",
    "advisor_title" "text",
    "advisor_description" "text",
    "advisor_cta_text" "text",
    "advisor_cta_link" "text",
    "popular_badge_text" "text",
    "bottom_cta_title" "text",
    "bottom_cta_description" "text",
    "bottom_primary_cta_text" "text",
    "bottom_primary_cta_link" "text",
    "bottom_secondary_cta_text" "text",
    "bottom_secondary_cta_link" "text"
);


ALTER TABLE "public"."pricing_page_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_items" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "price" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "badge" "text" DEFAULT ''::"text" NOT NULL,
    "inquire_link" "text" DEFAULT '/contact'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sku" "text",
    "brand" "text",
    "unit" "text" DEFAULT 'piece'::"text" NOT NULL,
    "barcode" "text",
    "supplier_id" bigint,
    "inventory_enabled" boolean DEFAULT false NOT NULL,
    "cost_price_minor" bigint DEFAULT 0 NOT NULL,
    "selling_price_minor" bigint DEFAULT 0 NOT NULL,
    "low_stock_threshold" numeric(14,3) DEFAULT 0 NOT NULL,
    "inventory_notes" "text",
    "deactivated_at" timestamp with time zone,
    CONSTRAINT "shop_items_inventory_money_check" CHECK ((("cost_price_minor" >= 0) AND ("selling_price_minor" >= 0))),
    CONSTRAINT "shop_items_low_stock_check" CHECK (("low_stock_threshold" >= (0)::numeric))
);


ALTER TABLE "public"."shop_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_shop_availability" AS
 SELECT "p"."id" AS "product_id",
        CASE
            WHEN (NOT "p"."inventory_enabled") THEN 'not_tracked'::"text"
            WHEN (COALESCE("sum"(
            CASE
                WHEN "v"."is_active" THEN "v"."current_quantity"
                ELSE (0)::numeric
            END), (0)::numeric) <= (0)::numeric) THEN 'out_of_stock'::"text"
            ELSE 'available'::"text"
        END AS "availability"
   FROM ("public"."shop_items" "p"
     LEFT JOIN "public"."inventory_product_variants" "v" ON (("v"."product_id" = "p"."id")))
  WHERE ("p"."is_active" = true)
  GROUP BY "p"."id", "p"."inventory_enabled";


ALTER VIEW "public"."public_shop_availability" OWNER TO "postgres";


ALTER TABLE "public"."shop_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."shop_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."shop_page_content" (
    "id" bigint DEFAULT 1 NOT NULL,
    "hero_badge" "text" DEFAULT 'A&A Pro Shop'::"text" NOT NULL,
    "hero_title" "text" DEFAULT 'Supplements, accessories, and apparel'::"text" NOT NULL,
    "hero_description" "text" DEFAULT 'Premium products curated for serious training.'::"text" NOT NULL,
    "hero_image" "text" DEFAULT ''::"text" NOT NULL,
    "hero_primary_cta_text" "text" DEFAULT 'Browse products'::"text" NOT NULL,
    "hero_primary_cta_link" "text" DEFAULT '/shop'::"text" NOT NULL,
    "hero_secondary_cta_text" "text" DEFAULT 'Contact team'::"text" NOT NULL,
    "hero_secondary_cta_link" "text" DEFAULT '/contact'::"text" NOT NULL,
    "summary_cards" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "catalog_title" "text" DEFAULT 'Product Catalog'::"text" NOT NULL,
    "catalog_description" "text" DEFAULT 'Select a category to filter products.'::"text" NOT NULL,
    "inquiry_button_text" "text" DEFAULT 'Inquire now'::"text" NOT NULL,
    "inquiry_link_default" "text" DEFAULT '/contact'::"text" NOT NULL,
    "items_per_page" integer DEFAULT 8 NOT NULL,
    "bottom_cta_title" "text" DEFAULT 'Need product guidance?'::"text" NOT NULL,
    "bottom_cta_description" "text" DEFAULT 'Talk to our team for goal-specific recommendations.'::"text" NOT NULL,
    "bottom_primary_cta_text" "text" DEFAULT 'Contact support'::"text" NOT NULL,
    "bottom_primary_cta_link" "text" DEFAULT '/contact'::"text" NOT NULL,
    "bottom_secondary_cta_text" "text" DEFAULT 'View memberships'::"text" NOT NULL,
    "bottom_secondary_cta_link" "text" DEFAULT '/pricing'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_page_content" OWNER TO "postgres";


ALTER TABLE "public"."stock_movements" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."stock_movements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "goal" "text" NOT NULL,
    "quote" "text" NOT NULL,
    "image" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."testimonials" OWNER TO "postgres";


ALTER TABLE "public"."testimonials" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."testimonials_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."trainer_page_content" (
    "id" integer NOT NULL,
    "pt_badge" "text" DEFAULT 'Personal Training'::"text" NOT NULL,
    "pt_title" "text" DEFAULT 'One-on-one coaching sessions available'::"text" NOT NULL,
    "pt_description" "text" DEFAULT ''::"text" NOT NULL,
    "pt_cta_text" "text" DEFAULT 'Book personal training'::"text" NOT NULL,
    "pt_cta_link" "text" DEFAULT '/contact'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hero_badge" "text",
    "hero_title" "text",
    "hero_description" "text",
    "hero_primary_cta_text" "text",
    "hero_primary_cta_link" "text",
    "hero_secondary_cta_text" "text",
    "hero_secondary_cta_link" "text",
    "strength_section_title" "text",
    "equipment_section_title" "text",
    "spotlight_count" integer DEFAULT 3 NOT NULL,
    "strength_metrics" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "equipment_zones" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."trainer_page_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainers" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "bio" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "specialties" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "years_experience" integer DEFAULT 0 NOT NULL,
    "offers_personal_training" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trainers" OWNER TO "postgres";


ALTER TABLE "public"."trainers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."trainers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."admin_settings"
    ADD CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_holidays"
    ADD CONSTRAINT "attendance_holidays_holiday_date_key" UNIQUE ("holiday_date");



ALTER TABLE ONLY "public"."attendance_holidays"
    ADD CONSTRAINT "attendance_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_unique_member_date" UNIQUE ("member_ref", "attendance_date");



ALTER TABLE ONLY "public"."contact_content"
    ADD CONSTRAINT "contact_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_faqs"
    ADD CONSTRAINT "contact_faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities_page_content"
    ADD CONSTRAINT "facilities_page_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_items"
    ADD CONSTRAINT "facility_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."footer_content"
    ADD CONSTRAINT "footer_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_content"
    ADD CONSTRAINT "home_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_maximus_points"
    ADD CONSTRAINT "home_maximus_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_status_items"
    ADD CONSTRAINT "home_status_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_product_variants"
    ADD CONSTRAINT "inventory_product_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_product_variants"
    ADD CONSTRAINT "inventory_variant_barcode_unique" UNIQUE ("barcode");



ALTER TABLE ONLY "public"."inventory_product_variants"
    ADD CONSTRAINT "inventory_variant_sku_unique" UNIQUE ("sku");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_number_sequences"
    ADD CONSTRAINT "invoice_number_sequences_pkey" PRIMARY KEY ("sequence_year");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_measurements"
    ADD CONSTRAINT "member_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_report_logs"
    ADD CONSTRAINT "member_report_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_transformations"
    ADD CONSTRAINT "member_transformations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_member_id_key" UNIQUE ("member_id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_training_plans"
    ADD CONSTRAINT "personal_training_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_items"
    ADD CONSTRAINT "pricing_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_page_content"
    ADD CONSTRAINT "pricing_page_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_items"
    ADD CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_page_content"
    ADD CONSTRAINT "shop_page_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainer_page_content"
    ADD CONSTRAINT "trainer_page_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainers"
    ADD CONSTRAINT "trainers_pkey" PRIMARY KEY ("id");



CREATE INDEX "attendance_holidays_date_idx" ON "public"."attendance_holidays" USING "btree" ("holiday_date");



CREATE INDEX "attendance_records_attendance_date_idx" ON "public"."attendance_records" USING "btree" ("attendance_date" DESC);



CREATE INDEX "attendance_records_deleted_at_idx" ON "public"."attendance_records" USING "btree" ("deleted_at");



CREATE INDEX "attendance_records_member_ref_idx" ON "public"."attendance_records" USING "btree" ("member_ref");



CREATE INDEX "attendance_records_status_idx" ON "public"."attendance_records" USING "btree" ("status");



CREATE INDEX "inventory_variants_product_idx" ON "public"."inventory_product_variants" USING "btree" ("product_id");



CREATE INDEX "invoice_items_invoice_idx" ON "public"."invoice_items" USING "btree" ("invoice_id");



CREATE INDEX "invoice_items_variant_idx" ON "public"."invoice_items" USING "btree" ("variant_id") WHERE ("variant_id" IS NOT NULL);



CREATE INDEX "invoice_payments_date_idx" ON "public"."invoice_payments" USING "btree" ("payment_date" DESC);



CREATE INDEX "invoice_payments_invoice_idx" ON "public"."invoice_payments" USING "btree" ("invoice_id");



CREATE INDEX "invoices_billing_date_idx" ON "public"."invoices" USING "btree" ("billing_date" DESC);



CREATE INDEX "invoices_member_idx" ON "public"."invoices" USING "btree" ("member_ref");



CREATE INDEX "invoices_payment_status_idx" ON "public"."invoices" USING "btree" ("payment_status");



CREATE INDEX "invoices_status_idx" ON "public"."invoices" USING "btree" ("invoice_status");



CREATE INDEX "member_measurements_member_ref_idx" ON "public"."member_measurements" USING "btree" ("member_ref", "recorded_at" DESC);



CREATE INDEX "member_report_logs_member_ref_idx" ON "public"."member_report_logs" USING "btree" ("member_ref", "sent_at" DESC);



CREATE INDEX "member_transformations_member_ref_idx" ON "public"."member_transformations" USING "btree" ("member_ref", "captured_at" DESC);



CREATE INDEX "members_deleted_at_idx" ON "public"."members" USING "btree" ("deleted_at");



CREATE INDEX "members_membership_status_idx" ON "public"."members" USING "btree" ("membership_status");



CREATE INDEX "members_payment_status_idx" ON "public"."members" USING "btree" ("payment_status");



CREATE INDEX "members_updated_at_idx" ON "public"."members" USING "btree" ("updated_at" DESC);



CREATE INDEX "shop_items_active_sort_idx" ON "public"."shop_items" USING "btree" ("is_active", "sort_order");



CREATE UNIQUE INDEX "shop_items_barcode_unique" ON "public"."shop_items" USING "btree" ("barcode") WHERE ("barcode" IS NOT NULL);



CREATE UNIQUE INDEX "shop_items_sku_unique" ON "public"."shop_items" USING "btree" ("lower"("sku")) WHERE ("sku" IS NOT NULL);



CREATE INDEX "stock_movements_invoice_idx" ON "public"."stock_movements" USING "btree" ("invoice_id") WHERE ("invoice_id" IS NOT NULL);



CREATE INDEX "stock_movements_variant_idx" ON "public"."stock_movements" USING "btree" ("variant_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "trg_admin_settings_updated_at" BEFORE UPDATE ON "public"."admin_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trg_attendance_holidays_updated_at" BEFORE UPDATE ON "public"."attendance_holidays" FOR EACH ROW EXECUTE FUNCTION "public"."set_attendance_holidays_updated_at"();



CREATE OR REPLACE TRIGGER "trg_attendance_records_updated_at" BEFORE UPDATE ON "public"."attendance_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_attendance_records_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inventory_suppliers_updated_at" BEFORE UPDATE ON "public"."inventory_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_inventory_billing_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inventory_variants_updated_at" BEFORE UPDATE ON "public"."inventory_product_variants" FOR EACH ROW EXECUTE FUNCTION "public"."set_inventory_billing_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_inventory_billing_updated_at"();



CREATE OR REPLACE TRIGGER "trg_members_updated_at" BEFORE UPDATE ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."set_members_updated_at"();



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_member_ref_fkey" FOREIGN KEY ("member_ref") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_product_variants"
    ADD CONSTRAINT "inventory_product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."inventory_product_variants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_reverses_payment_id_fkey" FOREIGN KEY ("reverses_payment_id") REFERENCES "public"."invoice_payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_member_ref_fkey" FOREIGN KEY ("member_ref") REFERENCES "public"."members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."member_measurements"
    ADD CONSTRAINT "member_measurements_member_ref_fkey" FOREIGN KEY ("member_ref") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_report_logs"
    ADD CONSTRAINT "member_report_logs_member_ref_fkey" FOREIGN KEY ("member_ref") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_transformations"
    ADD CONSTRAINT "member_transformations_member_ref_fkey" FOREIGN KEY ("member_ref") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_items"
    ADD CONSTRAINT "shop_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."inventory_product_variants"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."admin_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_settings_insert_admin" ON "public"."admin_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "admin_settings_select_admin" ON "public"."admin_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "admin_settings_update_admin" ON "public"."admin_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."attendance_holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_holidays_delete_admin" ON "public"."attendance_holidays" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "attendance_holidays_insert_admin" ON "public"."attendance_holidays" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "attendance_holidays_select_admin" ON "public"."attendance_holidays" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "attendance_holidays_update_admin" ON "public"."attendance_holidays" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."attendance_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_records_delete_admin" ON "public"."attendance_records" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "attendance_records_insert_admin" ON "public"."attendance_records" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "attendance_records_select_admin" ON "public"."attendance_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "attendance_records_update_admin" ON "public"."attendance_records" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."contact_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_content_admin_write" ON "public"."contact_content" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "contact_content_public_read" ON "public"."contact_content" FOR SELECT USING (true);



ALTER TABLE "public"."contact_faqs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_faqs_admin_write" ON "public"."contact_faqs" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "contact_faqs_public_read" ON "public"."contact_faqs" FOR SELECT USING (true);



ALTER TABLE "public"."facility_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facility_items_admin_write" ON "public"."facility_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "facility_items_public_read" ON "public"."facility_items" FOR SELECT USING (true);



ALTER TABLE "public"."footer_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "footer_content_admin_write" ON "public"."footer_content" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "footer_content_public_read" ON "public"."footer_content" FOR SELECT USING (true);



ALTER TABLE "public"."home_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "home_content_admin_write" ON "public"."home_content" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "home_content_public_read" ON "public"."home_content" FOR SELECT USING (true);



ALTER TABLE "public"."home_maximus_points" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "home_maximus_points_admin_write" ON "public"."home_maximus_points" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "home_maximus_points_public_read" ON "public"."home_maximus_points" FOR SELECT USING (true);



ALTER TABLE "public"."home_status_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "home_status_items_admin_write" ON "public"."home_status_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "home_status_items_public_read" ON "public"."home_status_items" FOR SELECT USING (true);



ALTER TABLE "public"."inventory_product_variants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_product_variants_select_admin" ON "public"."inventory_product_variants" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."inventory_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_suppliers_select_admin" ON "public"."inventory_suppliers" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "inventory_suppliers_write_admin" ON "public"."inventory_suppliers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "inventory_variants_write_admin" ON "public"."inventory_product_variants" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_items_select_admin" ON "public"."invoice_items" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "invoice_items_write_draft_admin" ON "public"."invoice_items" TO "authenticated" USING (("public"."is_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("i"."invoice_status" = 'draft'::"text")))))) WITH CHECK (("public"."is_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("i"."invoice_status" = 'draft'::"text"))))));



ALTER TABLE "public"."invoice_number_sequences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_number_sequences_select_admin" ON "public"."invoice_number_sequences" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."invoice_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_payments_select_admin" ON "public"."invoice_payments" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_insert_admin" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() AND ("invoice_status" = 'draft'::"text")));



CREATE POLICY "invoices_select_admin" ON "public"."invoices" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "invoices_update_draft_admin" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() AND ("invoice_status" = 'draft'::"text"))) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."member_measurements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_measurements_delete_admin" ON "public"."member_measurements" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_measurements_insert_admin" ON "public"."member_measurements" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_measurements_select_admin" ON "public"."member_measurements" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_measurements_update_admin" ON "public"."member_measurements" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."member_report_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_report_logs_delete_admin" ON "public"."member_report_logs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_report_logs_insert_admin" ON "public"."member_report_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_report_logs_select_admin" ON "public"."member_report_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_report_logs_update_admin" ON "public"."member_report_logs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."member_transformations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_transformations_delete_admin" ON "public"."member_transformations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_transformations_insert_admin" ON "public"."member_transformations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_transformations_select_admin" ON "public"."member_transformations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "member_transformations_update_admin" ON "public"."member_transformations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members_delete_admin" ON "public"."members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "members_insert_admin" ON "public"."members" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "members_select_admin" ON "public"."members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "members_update_admin" ON "public"."members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."personal_training_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "personal_training_plans_admin_write" ON "public"."personal_training_plans" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "personal_training_plans_public_read" ON "public"."personal_training_plans" FOR SELECT USING (true);



ALTER TABLE "public"."pricing_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_items_admin_write" ON "public"."pricing_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "pricing_items_public_read" ON "public"."pricing_items" FOR SELECT USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_movements_select_admin" ON "public"."stock_movements" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "testimonials_admin_write" ON "public"."testimonials" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "testimonials_public_read" ON "public"."testimonials" FOR SELECT USING (true);



ALTER TABLE "public"."trainer_page_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainer_page_content_admin_write" ON "public"."trainer_page_content" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "trainer_page_content_public_read" ON "public"."trainer_page_content" FOR SELECT USING (true);



ALTER TABLE "public"."trainers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainers_admin_write" ON "public"."trainers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "trainers_public_read" ON "public"."trainers" FOR SELECT USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_invoice"("p_invoice_id" bigint, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_invoice"("p_invoice_id" bigint, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_invoice"("p_invoice_id" bigint, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_invoice"("p_invoice_id" bigint, "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint, "p_payment_method" "text", "p_payment_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint, "p_payment_method" "text", "p_payment_reference" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint, "p_payment_method" "text", "p_payment_reference" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint, "p_payment_method" "text", "p_payment_reference" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_invoice_payment_state"("p_invoice_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_invoice_payment_state"("p_invoice_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_invoice_payment_state"("p_invoice_id" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."invoice_payments" TO "anon";
GRANT ALL ON TABLE "public"."invoice_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_payments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_invoice_payment"("p_invoice_id" bigint, "p_amount_minor" bigint, "p_payment_method" "text", "p_payment_date" "date", "p_reference" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_invoice_payment"("p_invoice_id" bigint, "p_amount_minor" bigint, "p_payment_method" "text", "p_payment_date" "date", "p_reference" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_invoice_payment"("p_invoice_id" bigint, "p_amount_minor" bigint, "p_payment_method" "text", "p_payment_date" "date", "p_reference" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_invoice_payment"("p_invoice_id" bigint, "p_amount_minor" bigint, "p_payment_method" "text", "p_payment_date" "date", "p_reference" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_stock_movement"("p_variant_id" bigint, "p_movement_type" "text", "p_quantity_delta" numeric, "p_reference" "text", "p_notes" "text", "p_supplier_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_stock_movement"("p_variant_id" bigint, "p_movement_type" "text", "p_quantity_delta" numeric, "p_reference" "text", "p_notes" "text", "p_supplier_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."record_stock_movement"("p_variant_id" bigint, "p_movement_type" "text", "p_quantity_delta" numeric, "p_reference" "text", "p_notes" "text", "p_supplier_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_stock_movement"("p_variant_id" bigint, "p_movement_type" "text", "p_quantity_delta" numeric, "p_reference" "text", "p_notes" "text", "p_supplier_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_admin_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_admin_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_admin_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_attendance_holidays_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_attendance_holidays_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_attendance_holidays_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_attendance_records_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_attendance_records_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_attendance_records_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_inventory_billing_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_inventory_billing_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_inventory_billing_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_members_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_members_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_members_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_settings" TO "anon";
GRANT ALL ON TABLE "public"."admin_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_settings" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_holidays" TO "anon";
GRANT ALL ON TABLE "public"."attendance_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_holidays" TO "service_role";



GRANT ALL ON SEQUENCE "public"."attendance_holidays_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."attendance_holidays_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."attendance_holidays_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_records" TO "anon";
GRANT ALL ON TABLE "public"."attendance_records" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_records" TO "service_role";



GRANT ALL ON SEQUENCE "public"."attendance_records_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."attendance_records_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."attendance_records_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."contact_content" TO "anon";
GRANT ALL ON TABLE "public"."contact_content" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_content" TO "service_role";



GRANT ALL ON TABLE "public"."contact_faqs" TO "anon";
GRANT ALL ON TABLE "public"."contact_faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_faqs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contact_faqs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contact_faqs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contact_faqs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."facilities_page_content" TO "anon";
GRANT ALL ON TABLE "public"."facilities_page_content" TO "authenticated";
GRANT ALL ON TABLE "public"."facilities_page_content" TO "service_role";



GRANT ALL ON TABLE "public"."facility_items" TO "anon";
GRANT ALL ON TABLE "public"."facility_items" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."facility_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."facility_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."facility_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."footer_content" TO "anon";
GRANT ALL ON TABLE "public"."footer_content" TO "authenticated";
GRANT ALL ON TABLE "public"."footer_content" TO "service_role";



GRANT ALL ON TABLE "public"."home_content" TO "anon";
GRANT ALL ON TABLE "public"."home_content" TO "authenticated";
GRANT ALL ON TABLE "public"."home_content" TO "service_role";



GRANT ALL ON TABLE "public"."home_maximus_points" TO "anon";
GRANT ALL ON TABLE "public"."home_maximus_points" TO "authenticated";
GRANT ALL ON TABLE "public"."home_maximus_points" TO "service_role";



GRANT ALL ON SEQUENCE "public"."home_maximus_points_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."home_maximus_points_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."home_maximus_points_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."home_status_items" TO "anon";
GRANT ALL ON TABLE "public"."home_status_items" TO "authenticated";
GRANT ALL ON TABLE "public"."home_status_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."home_status_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."home_status_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."home_status_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_product_variants" TO "anon";
GRANT ALL ON TABLE "public"."inventory_product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_product_variants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_product_variants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_product_variants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_product_variants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."inventory_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_suppliers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_suppliers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_suppliers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_suppliers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_number_sequences" TO "anon";
GRANT ALL ON TABLE "public"."invoice_number_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_number_sequences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_payments_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."member_measurements" TO "anon";
GRANT ALL ON TABLE "public"."member_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."member_measurements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."member_measurements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."member_measurements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."member_measurements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."member_report_logs" TO "anon";
GRANT ALL ON TABLE "public"."member_report_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."member_report_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."member_report_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."member_report_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."member_report_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."member_transformations" TO "anon";
GRANT ALL ON TABLE "public"."member_transformations" TO "authenticated";
GRANT ALL ON TABLE "public"."member_transformations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."member_transformations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."member_transformations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."member_transformations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."personal_training_plans" TO "anon";
GRANT ALL ON TABLE "public"."personal_training_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_training_plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."personal_training_plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."personal_training_plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."personal_training_plans_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_items" TO "anon";
GRANT ALL ON TABLE "public"."pricing_items" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pricing_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pricing_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pricing_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_page_content" TO "anon";
GRANT ALL ON TABLE "public"."pricing_page_content" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_page_content" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."shop_items" TO "anon";
GRANT ALL ON TABLE "public"."shop_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_items" TO "service_role";



GRANT ALL ON TABLE "public"."public_shop_availability" TO "anon";
GRANT ALL ON TABLE "public"."public_shop_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."public_shop_availability" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shop_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shop_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shop_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shop_page_content" TO "anon";
GRANT ALL ON TABLE "public"."shop_page_content" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_page_content" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."testimonials" TO "anon";
GRANT ALL ON TABLE "public"."testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonials" TO "service_role";



GRANT ALL ON SEQUENCE "public"."testimonials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."testimonials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."testimonials_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trainer_page_content" TO "anon";
GRANT ALL ON TABLE "public"."trainer_page_content" TO "authenticated";
GRANT ALL ON TABLE "public"."trainer_page_content" TO "service_role";



GRANT ALL ON TABLE "public"."trainers" TO "anon";
GRANT ALL ON TABLE "public"."trainers" TO "authenticated";
GRANT ALL ON TABLE "public"."trainers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trainers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trainers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trainers_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






