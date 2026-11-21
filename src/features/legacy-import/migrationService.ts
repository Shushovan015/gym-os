import { supabase } from '@src/Client/supabase';
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

export interface ImportOptions {
  fileName: string;
  sqlContent: string;
  dryRun?: boolean;
}

export async function runLegacyImport(options: ImportOptions): Promise<MigrationResult> {
  const { fileName, sqlContent, dryRun = false } = options;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sign in as an administrator before importing.');

  const { error: accessError } = await supabase.rpc('import_legacy_bill', { p_invoice: null });
  if (accessError?.code === 'PGRST202') throw new Error('The legacy import database update is missing. Apply the pending Supabase migrations before importing.');
  if (accessError) throw new Error(accessError.message);

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

    const legacyMemberIds = new Map(memberMigrationData.map((member) => [member.legacy_register_id, member.legacy_register_id]));
    for (const row of parsedData.officeregister) {
      const migrated = migrateOfficeRegisterRow(row, context, legacyMemberIds);
      membershipFeeData.push(...migrated);
    }

    for (const row of parsedData.bill) {
      const { invoice, payment } = migrateBillRow(row, context, legacyMemberIds);
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

    const memberIdMap = await importMembers(memberMigrationData);

    for (const [legacyId, newId] of memberIdMap.entries()) {
      context.legacyToNewMap.register.set(legacyId, newId);
    }

    membersImported = memberIdMap.size;

    membershipsImported = await importMembershipFees(membershipFeeData, memberIdMap);

    // Imported members are inserted inactive so legacy fee rows can be loaded
    // first. Activate them now; the activation trigger generates any missing
    // membership fee periods without duplicating the imported rows.
    for (const memberId of memberIdMap.values()) {
      const { error } = await supabase.from('members').update({ is_active: true })
        .eq('id', memberId).eq('is_active', false).is('deleted_at', null).is('deactivated_at', null);
      if (error) throw new Error('Failed to activate imported member: ' + error.message);
    }

    const { importedInvoices, importedPayments } = await importInvoicesAndPayments(
      invoiceData,
      paymentData,
      memberIdMap
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
  members: MemberMigrationData[]
): Promise<Map<number, number>> {
  const legacyToNewMap = new Map<number, number>();

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
      .eq('member_id', newMemberId)
      .eq('billing_month', fee.billing_month)
      .maybeSingle();

    if (selectError) {
      if (selectError.code === 'PGRST204' || selectError.message?.includes('column') || selectError.message?.includes('legacy_officeregister_id')) {
        throw new Error(`Database migration not applied: 'legacy_officeregister_id' column missing. Apply migration 202610040001_legacy_import_tables.sql`);
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
  memberIdMap: Map<number, number>
) {
  let importedInvoices = 0;
  let importedPayments = 0;
  const paymentByBill = new Map(payments.map((payment) => [payment.legacy_bill_id, payment]));

  for (const invoice of invoices) {
    const memberId = memberIdMap.get(invoice.member_ref);
    if (!memberId) continue;

    const { data, error } = await supabase.rpc('import_legacy_bill', {
      p_invoice: { ...invoice, member_ref: memberId },
      p_payment: paymentByBill.get(invoice.legacy_bill_id) ?? null,
    });
    if (error) throw new Error('Failed to import legacy bill ' + invoice.legacy_bill_id + ': ' + error.message);
    if (data?.invoice_added) importedInvoices++;
    if (data?.payment_added) importedPayments++;
  }
  return { importedInvoices, importedPayments };
}

async function createImportLog(log: ImportLogEntry): Promise<void> {
  const { error } = await supabase.from('import_logs').insert({
    file_name: log.fileName,
    import_date: log.importDate,
    members_found: log.membersFound,
    members_imported: log.membersImported,
    memberships_imported: log.membershipsImported,
    bills_imported: log.billsImported,
    warnings: log.warnings,
    errors: log.errors,
    skipped_records: log.skippedRecords,
    preserved_in_notes: log.preservedInNotes,
    status: log.status,
    error_details: log.errorDetails,
  });
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