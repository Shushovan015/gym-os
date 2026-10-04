import { createClient } from '@supabase/supabase-js';
import type {
  ParsedLegacyData,
  MemberMigrationData,
  MembershipFeeMigrationData,
  InvoiceMigrationData,
  InvoicePaymentMigrationData,
  MigrationResult,
  ImportLogEntry,
} from './types';
import { parseLegacySQLDump, validateParsedData } from './parser/sqlParser';
import {
  createMigrationContext,
  migrateRegisterRow,
  migrateOfficeRegisterRow,
  migrateBillRow,
  generateImportPreview,
  generateFieldCompletenessReport,
} from './mapping';
import { formatImportPreview, formatCompletenessReport } from './preview';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Check VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface ImportOptions {
  fileName: string;
  sqlContent: string;
  adminUserId: string;
  dryRun?: boolean;
}

export async function runLegacyImport(options: ImportOptions): Promise<MigrationResult> {
  const { fileName, sqlContent, adminUserId, dryRun = false } = options;

  const warnings: MigrationResult['warnings'] = [];
  const errors: string[] = [];
  let membersImported = 0;
  let membershipsImported = 0;
  let paymentsImported = 0;
  let skippedRecords = 0;
  const preservedInNotesCount = 0;

  try {
    const parsedData = parseLegacySQLDump(sqlContent);
    const validation = validateParsedData(parsedData);

    if (!validation.valid) {
      errors.push(...validation.errors);
      if (errors.length > 0) {
        return createFailedResult(errors, warnings, 0, 0, 0, skippedRecords, preservedInNotesCount);
      }
    }

    const existingMembers = await fetchExistingMembers();
    const context = createMigrationContext(existingMembers);

    const memberMigrationData: MemberMigrationData[] = [];
    const membershipFeeData: MembershipFeeMigrationData[] = [];
    const invoiceData: InvoiceMigrationData[] = [];
    const paymentData: InvoicePaymentMigrationData[] = [];

    for (const row of parsedData.register) {
      const migrated = migrateRegisterRow(row, context);
      if (migrated) {
        memberMigrationData.push(migrated);
      } else {
        skippedRecords++;
      }
    }

    for (const row of parsedData.officeregister) {
      const migrated = migrateOfficeRegisterRow(row, context, context.legacyToNewMap.register);
      membershipFeeData.push(...migrated);
    }

    for (const row of parsedData.bill) {
      const { invoice, payment } = migrateBillRow(row, context, context.legacyToNewMap.register);
      if (invoice) invoiceData.push(invoice);
      if (payment) paymentData.push(payment);
    }

    const preview = generateImportPreview(parsedData, context);
    const completenessReport = generateFieldCompletenessReport(parsedData);

    console.log(formatImportPreview(preview));
    console.log(formatCompletenessReport(completenessReport));

    if (dryRun) {
      return {
        success: true,
        membersImported: 0,
        membershipsImported: 0,
        paymentsImported: 0,
        warnings: context.warnings,
        errors: [],
        skippedRecords,
        preservedInNotesCount: preview.fieldsRequiringNotes,
      };
    }

    const memberIdMap = await importMembers(memberMigrationData, adminUserId);

    for (const [legacyId, newId] of memberIdMap.entries()) {
      context.legacyToNewMap.register.set(legacyId, newId);
    }

    membersImported = memberIdMap.size;

    membershipsImported = await importMembershipFees(membershipFeeData, adminUserId, context.legacyToNewMap.register);

    const { importedInvoices, importedPayments } = await importInvoicesAndPayments(
      invoiceData,
      paymentData,
      adminUserId,
      context.legacyToNewMap.register
    );

    paymentsImported = importedPayments;

    await createImportLog({
      fileName,
      importDate: new Date().toISOString(),
      membersFound: parsedData.register.length,
      membersImported,
      membershipsImported,
      billsImported: importedInvoices,
      warnings: context.warnings.length,
      errors: errors.length,
      skippedRecords,
      preservedInNotes: preview.fieldsRequiringNotes,
      status: errors.length > 0 ? 'partial' : 'completed',
    });

    return {
      success: errors.length === 0,
      membersImported,
      membershipsImported,
      paymentsImported,
      warnings: context.warnings,
      errors,
      skippedRecords,
      preservedInNotesCount: preview.fieldsRequiringNotes,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    console.error('Migration failed:', error);

    await createImportLog({
      fileName,
      importDate: new Date().toISOString(),
      membersFound: 0,
      membersImported: 0,
      membershipsImported: 0,
      billsImported: 0,
      warnings: warnings.length,
      errors: errors.length,
      skippedRecords,
      preservedInNotes: 0,
      status: 'failed',
      errorDetails: errorMessage,
    });

    return createFailedResult(errors, warnings, membersImported, membershipsImported, paymentsImported, skippedRecords, preservedInNotesCount);
  }
}

function createFailedResult(
  errors: string[],
  warnings: MigrationResult['warnings'],
  membersImported: number,
  membershipsImported: number,
  paymentsImported: number,
  skippedRecords: number,
  preservedInNotesCount: number
): MigrationResult {
  return {
    success: false,
    membersImported,
    membershipsImported,
    paymentsImported,
    warnings,
    errors,
    skippedRecords,
    preservedInNotesCount,
  };
}

async function fetchExistingMembers(): Promise<Array<{ id: number; member_id: string; full_name: string; phone: string; email: string | null }>> {
  const { data, error } = await supabase
    .from('members')
    .select('id, member_id, full_name, phone, email')
    .is('deleted_at', null);

  if (error) throw error;
  return data || [];
}

async function importMembers(
  members: MemberMigrationData[],
  adminUserId: string
): Promise<Map<number, number>> {
  const legacyToNewMap = new Map<number, number>();

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(adminUserId)) {
    throw new Error(`Invalid admin user ID format. Must be a valid UUID from Supabase Auth. Got: ${adminUserId}`);
  }

  for (const member of members) {
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('legacy_register_id', member.legacy_register_id)
      .eq('legacy_source', member.legacy_source)
      .maybeSingle();

    if (existing) {
      legacyToNewMap.set(member.legacy_register_id, existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from('members')
      .insert({
        member_id: member.member_id,
        full_name: member.full_name,
        email: member.email,
        phone: member.phone,
        address: member.address,
        photo_url: member.photo_url,
        membership_type: member.membership_type,
        membership_status: member.membership_status,
        start_date: member.start_date,
        end_date: member.end_date,
        last_visit_date: member.last_visit_date,
        payment_status: member.payment_status,
        payment_due_date: member.payment_due_date,
        notes: member.notes,
        legacy_register_id: member.legacy_register_id,
        legacy_source: member.legacy_source,
      })
      .select('id')
      .single();

    if (error) {
      const errMsg = `Failed to import member ${member.legacy_register_id} (${member.full_name}): ${error.message} (code: ${error.code})`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    legacyToNewMap.set(member.legacy_register_id, data.id);
  }

  return legacyToNewMap;
}

async function importMembershipFees(
  fees: MembershipFeeMigrationData[],
  _adminUserId: string,
  memberIdMap: Map<number, number>
): Promise<number> {
  let imported = 0;

  for (const fee of fees) {
    const newMemberId = memberIdMap.get(fee.member_id);
    if (!newMemberId) continue;

    const { data: existing, error: selectError } = await supabase
      .from('membership_fees')
      .select('id')
      .eq('legacy_officeregister_id', fee.legacy_officeregister_id)
      .eq('legacy_source', fee.legacy_source)
      .maybeSingle();

    if (selectError) {
      if (selectError.code === 'PGRST204' || selectError.message?.includes('column') || selectError.message?.includes('legacy_officeregister_id')) {
        throw new Error(`Database migration not applied: 'legacy_officeregister_id' column missing. Run: supabase db reset or apply migration 202610040001_legacy_import_tables.sql`);
      }
      throw new Error(`Failed to check existing fee: ${selectError.message} (code: ${selectError.code})`);
    }

    if (existing) continue;

    const { error } = await supabase
      .from('membership_fees')
      .insert({
        member_id: newMemberId,
        billing_month: fee.billing_month,
        amount_minor: fee.amount_minor,
        currency_code: fee.currency_code,
        status: fee.status,
        paid_amount_minor: fee.paid_amount_minor,
        due_date: fee.due_date,
        paid_at: fee.paid_at,
        paid_by: fee.paid_by,
        invoice_id: fee.invoice_id,
        notes: fee.notes,
        legacy_officeregister_id: fee.legacy_officeregister_id,
        legacy_source: fee.legacy_source,
      });

    if (error) throw new Error(`Failed to insert fee: ${error.message} (code: ${error.code})`);
    imported++;
  }

  return imported;
}

async function importInvoicesAndPayments(
  invoices: InvoiceMigrationData[],
  payments: InvoicePaymentMigrationData[],
  adminUserId: string,
  memberIdMap: Map<number, number>
): Promise<{ importedInvoices: number; importedPayments: number }> {
  let importedInvoices = 0;
  let importedPayments = 0;
  const invoiceIdMap = new Map<number, number>();

  for (const invoice of invoices) {
    const newMemberId = memberIdMap.get(invoice.member_ref);
    if (!newMemberId) continue;

    const { data: existing, error: selectError } = await supabase
      .from('invoices')
      .select('id')
      .eq('legacy_bill_id', invoice.legacy_bill_id)
      .eq('legacy_source', invoice.legacy_source)
      .maybeSingle();

    if (selectError) {
      if (selectError.code === 'PGRST204' || selectError.message?.includes('column') || selectError.message?.includes('legacy_bill_id')) {
        throw new Error(`Database migration not applied: 'legacy_bill_id' column missing. Run: supabase db reset or apply migration 202610040001_legacy_import_tables.sql`);
      }
      throw new Error(`Failed to check existing invoice: ${selectError.message} (code: ${selectError.code})`);
    }

    if (existing) {
      invoiceIdMap.set(invoice.legacy_bill_id, existing.id);
      continue;
    }

    const memberData = await supabase
      .from('members')
      .select('full_name, phone, email')
      .eq('id', newMemberId)
      .single();

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        member_ref: newMemberId,
        customer_name: memberData.data?.full_name || invoice.customer_name,
        customer_phone: memberData.data?.phone || invoice.customer_phone,
        customer_email: memberData.data?.email || invoice.customer_email,
        billing_date: invoice.billing_date,
        due_date: invoice.due_date,
        invoice_status: invoice.invoice_status,
        payment_status: invoice.payment_status,
        currency_code: invoice.currency_code,
        subtotal_minor: invoice.subtotal_minor,
        discount_minor: invoice.discount_minor,
        tax_minor: invoice.tax_minor,
        total_minor: invoice.total_minor,
        paid_minor: invoice.paid_minor,
        balance_minor: invoice.balance_minor,
        tax_enabled: invoice.tax_enabled,
        tax_label: invoice.tax_label,
        tax_rate_basis_points: invoice.tax_rate_basis_points,
        notes: invoice.notes,
        legacy_bill_id: invoice.legacy_bill_id,
        legacy_source: invoice.legacy_source,
        created_by: invoice.created_by,
        updated_by: adminUserId,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to import invoice ${invoice.legacy_bill_id}: ${error.message} (code: ${error.code})`);

    invoiceIdMap.set(invoice.legacy_bill_id, data.id);
    importedInvoices++;
  }

  for (const payment of payments) {
    const invoiceId = invoiceIdMap.get(payment.legacy_bill_id);
    if (!invoiceId) continue;

    const { data: existing, error: selectError } = await supabase
      .from('invoice_payments')
      .select('id')
      .eq('legacy_bill_id', payment.legacy_bill_id)
      .eq('legacy_source', payment.legacy_source)
      .maybeSingle();

    if (selectError) {
      if (selectError.code === 'PGRST204' || selectError.message?.includes('column') || selectError.message?.includes('legacy_bill_id')) {
        throw new Error(`Database migration not applied: 'legacy_bill_id' column missing in invoice_payments. Run: supabase db reset or apply migration 202610040001_legacy_import_tables.sql`);
      }
      throw new Error(`Failed to check existing payment: ${selectError.message} (code: ${selectError.code})`);
    }

    if (existing) continue;

    const { error } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        amount_minor: payment.amount_minor,
        payment_method: payment.payment_method,
        payment_date: payment.payment_date,
        reference: payment.reference,
        notes: payment.notes,
        is_reversal: payment.is_reversal,
        legacy_bill_id: payment.legacy_bill_id,
        legacy_source: payment.legacy_source,
        received_by: payment.received_by,
      });

    if (error) throw new Error(`Failed to import payment ${payment.legacy_bill_id}: ${error.message} (code: ${error.code})`);
    importedPayments++;
  }

  return { importedInvoices, importedPayments };
}

async function createImportLog(log: ImportLogEntry): Promise<void> {
  const { error } = await supabase.from('import_logs').insert(log);
  if (error) console.error('Failed to create import log:', error);
}

export async function previewLegacyImport(sqlContent: string): Promise<{
  preview: ReturnType<typeof generateImportPreview>;
  completenessReport: ReturnType<typeof generateFieldCompletenessReport>;
  parsedData: ParsedLegacyData;
}> {
  const parsedData = parseLegacySQLDump(sqlContent);
  const validation = validateParsedData(parsedData);

  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const existingMembers = await fetchExistingMembers();
  const context = createMigrationContext(existingMembers);

  for (const row of parsedData.register) {
    migrateRegisterRow(row, context);
  }

  for (const row of parsedData.officeregister) {
    migrateOfficeRegisterRow(row, context, context.legacyToNewMap.register);
  }

  for (const row of parsedData.bill) {
    migrateBillRow(row, context, context.legacyToNewMap.register);
  }

  const preview = generateImportPreview(parsedData, context);
  const completenessReport = generateFieldCompletenessReport(parsedData);

  return { preview, completenessReport, parsedData };
}