CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid, email text, encrypted_password text);
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001', 'rehearsal@example.test', 'excluded-fixture-hash');
CREATE TABLE public.profiles (id uuid, role text);
INSERT INTO public.profiles VALUES ('00000000-0000-4000-8000-000000000001', 'admin');
CREATE TABLE storage.objects (bucket_id text, name text, metadata jsonb);
INSERT INTO storage.objects VALUES ('gym-media', 'fixture/catalog.webp', '{"size":25}');
CREATE TABLE members (id bigint, member_id text, full_name text, phone text, membership_type text,
    membership_status text, payment_status text, is_active boolean, created_at timestamptz, source_fixture_note text);
INSERT INTO members VALUES
    (101,'FIXTURE-101','Rehearsal member','+9770000000001','monthly','active','overdue',true,'2025-02-01 02:00:00+05:45','offline only'),
    (102,'FIXTURE-102','Inactive fixture','+9770000000002','monthly','expired','paid',false,'2025-02-01 02:00:00+05:45',NULL);
CREATE TABLE attendance_records (id bigint, member_ref bigint, attendance_date date, status text);
INSERT INTO attendance_records VALUES (110,101,'2025-02-01','present');
CREATE TABLE shop_items (id bigint, title text, category text, inventory_enabled boolean, cost_price_minor bigint, image text);
INSERT INTO shop_items VALUES (120,'Fixture product','Fixture',true,800,'https://example.test/storage/v1/object/public/gym-media/fixture/catalog.webp');
CREATE TABLE inventory_product_variants (id bigint, product_id bigint, sku text, current_quantity numeric(14,3));
INSERT INTO inventory_product_variants VALUES (121,120,'FIXTURE-121',2.125);
CREATE TABLE invoices (id bigint, invoice_number text, member_ref bigint, customer_name text, billing_date date, invoice_status text,
    payment_status text, subtotal_minor bigint, total_minor bigint, paid_minor bigint, balance_minor bigint, created_by uuid, legacy_source text);
INSERT INTO invoices VALUES
    (201,'901',101,'Rehearsal member','2025-02-10','issued','paid',1200,1200,1200,0,'00000000-0000-4000-8000-000000000001',NULL),
    (202,'902',102,'Inactive fixture','2025-02-11','cancelled','unpaid',900,900,0,900,'00000000-0000-4000-8000-000000000001',NULL),
    (203,'903',101,'Rehearsal member','2025-02-12','issued','partially_paid',750,750,250,500,'00000000-0000-4000-8000-000000000001','legacy_mysql');
CREATE TABLE invoice_payments (id bigint, invoice_id bigint, amount_minor bigint, payment_method text, payment_date date,
    is_reversal boolean, reverses_payment_id bigint, received_by uuid);
INSERT INTO invoice_payments VALUES
    (301,201,1200,'cash','2025-02-10',false,NULL,'00000000-0000-4000-8000-000000000001'),
    (303,202,900,'cash','2025-02-12',true,302,'00000000-0000-4000-8000-000000000001'),
    (302,202,900,'cash','2025-02-11',false,NULL,'00000000-0000-4000-8000-000000000001'),
    (304,203,250,'card','2025-02-12',false,NULL,'00000000-0000-4000-8000-000000000001');
CREATE TABLE invoice_items (id bigint, invoice_id bigint, item_type text, description text, quantity numeric(14,3),
    unit_price_minor bigint, line_total_minor bigint, product_id bigint, variant_id bigint);
INSERT INTO invoice_items VALUES
    (501,201,'membership','January',1,600,600,NULL,NULL),
    (502,201,'membership','February',1,600,600,NULL,NULL),
    (503,203,'product','Fixture sale',0.250,3000,750,120,121);
CREATE TABLE membership_fees (id bigint, member_id bigint, billing_month date, amount_minor bigint,
    paid_amount_minor bigint, status text, due_date date, invoice_id bigint);
INSERT INTO membership_fees VALUES
    (401,101,'2025-01-01',600,600,'paid','2025-01-10',201),
    (402,101,'2025-02-01',1200,600,'partial','2025-02-10',201);
CREATE TABLE membership_payment_allocations (payment_id bigint, fee_id bigint, invoice_item_id bigint, amount_minor bigint);
INSERT INTO membership_payment_allocations VALUES (301,401,501,600),(301,402,502,600);
CREATE TABLE stock_movements (id bigint, variant_id bigint, invoice_id bigint, movement_type text,
    quantity_delta numeric(14,3), previous_quantity numeric(14,3), resulting_quantity numeric(14,3), created_by uuid);
INSERT INTO stock_movements VALUES (601,121,203,'sale',-0.250,2.375,2.125,'00000000-0000-4000-8000-000000000001');
CREATE TABLE home_content (id bigint, hero_title text, gallery_images jsonb);
INSERT INTO home_content VALUES (1,'Rehearsal homepage','[]');
CREATE TABLE invoice_email_deliveries (invoice_id bigint, status text, recipient_email text, sent_at timestamptz);
INSERT INTO invoice_email_deliveries VALUES (201,'sent','rehearsal@example.test','2025-02-10 12:00:00+05:45'), (203,'sending','rehearsal@example.test',NULL);
CREATE TABLE public.invoice_number_sequences (sequence_year integer NOT NULL, last_number bigint NOT NULL);
INSERT INTO public.invoice_number_sequences VALUES (2023, 910), (2024, 805);
