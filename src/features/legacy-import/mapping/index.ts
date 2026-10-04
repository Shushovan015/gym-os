import type {
  LegacyRegisterRow,
  LegacyOfficeRegisterRow,
  LegacyBillRow,
  MemberMigrationData,
  MembershipFeeMigrationData,
  InvoiceMigrationData,
  InvoicePaymentMigrationData,
  LegacyToNewIdMap,
  ImportWarning,
  InvalidRecord,
  MissingReference,
  DuplicateCandidate,
  ParsedLegacyData,
} from '../types';
import type { RegisterField, OfficeRegisterField, BillField } from '../types';
import {
  parseLegacyDate,
  parseLegacyDob,
  normalizePhone,
  normalizeEmail,
  normalizeGender,
  normalizeAge,
  normalizeMembershipType,
  normalizeMembershipStatus,
  normalizePaymentStatus,
  generateMemberId,
  buildAdditionalInfo,
  isPlaceholder,
} from '../normalizer';

export interface MigrationContext {
  existingMembers: Array<{ id: number; member_id: string; full_name: string; phone: string; email: string | null }>;
  legacyToNewMap: LegacyToNewIdMap;
  warnings: ImportWarning[];
  invalidRecords: InvalidRecord[];
  missingReferences: MissingReference[];
  duplicateCandidates: DuplicateCandidate[];
}

export function createMigrationContext(existingMembers: MigrationContext['existingMembers']): MigrationContext {
  return {
    existingMembers,
    legacyToNewMap: {
      register: new Map(),
      officeregister: new Map(),
      bill: new Map(),
    },
    warnings: [],
    invalidRecords: [],
    missingReferences: [],
    duplicateCandidates: [],
  };
}

export function migrateRegisterRow(
  row: LegacyRegisterRow,
  context: MigrationContext
): MemberMigrationData | null {
  const warnings: ImportWarning[] = [];
  const invalidRecords: InvalidRecord[] = [];
  
  if (!row.id || row.id <= 0) {
    invalidRecords.push({
      table: 'register',
      legacyId: row.id,
      field: 'id',
      value: String(row.id),
      reason: 'Invalid or missing ID',
    });
    context.warnings.push(...warnings);
    context.invalidRecords.push(...invalidRecords);
    return null;
  }
  
  const name = row.name?.trim();
  if (!name || name.length < 2) {
    invalidRecords.push({
      table: 'register',
      legacyId: row.id,
      field: 'name',
      value: row.name || '',
      reason: 'Name too short or missing',
    });
    context.warnings.push(...warnings);
    context.invalidRecords.push(...invalidRecords);
    return null;
  }
  
  const parsedDob = parseLegacyDob(row.dob);
  const parsedDateAd = parseLegacyDate(row.datebs, row.datead);
  
  const phoneResult = normalizePhone(row.telephone, row.mobile);
  const emailResult = normalizeEmail(row.email);
  normalizeGender(row.sex);
  normalizeAge(row.age);
  
  const additionalInfoFields: Record<string, string | null> = {};
  
  if (row.nationality && !isPlaceholder(row.nationality)) {
    additionalInfoFields.nationality = row.nationality;
  }
  if (row.occupation && !isPlaceholder(row.occupation)) {
    additionalInfoFields.occupation = row.occupation;
  }
  if (row.telephone && phoneResult.secondary) {
    additionalInfoFields.telephone = row.telephone;
  }
  if (row.taddress && !isPlaceholder(row.taddress)) {
    additionalInfoFields.taddress = row.taddress;
  }
  if (!parsedDob.isValid && row.dob) {
    additionalInfoFields.legacy_dob = row.dob;
  }
  if (!parsedDateAd.isValid && (row.datebs || row.datead)) {
    if (row.datebs) additionalInfoFields.legacy_datebs = row.datebs;
    if (row.datead) additionalInfoFields.legacy_datead = row.datead;
  }
  
  const memberId = generateMemberId(row.id);
  
  const duplicate = findDuplicateMember(row, context.existingMembers);
  if (duplicate) {
    context.duplicateCandidates.push({
      type: 'member',
      legacyId: row.id,
      existingId: duplicate.id,
      matchReason: `Name: ${name}, Phone: ${phoneResult.primary || 'none'}`,
      legacyData: { ...row },
      existingData: duplicate,
    });
  }
  
  const addressParts = [];
  if (row.caddress && !isPlaceholder(row.caddress)) addressParts.push(row.caddress);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;
  
  const additionalInfo = buildAdditionalInfo(additionalInfoFields);
  
  const memberData: MemberMigrationData = {
    member_id: memberId,
    full_name: name,
    email: emailResult.email,
    phone: phoneResult.primary || '',
    address,
    photo_url: null,
    membership_type: 'monthly',
    membership_status: 'active',
    start_date: parsedDateAd.adDate,
    end_date: null,
    last_visit_date: null,
    payment_status: 'unpaid',
    payment_due_date: null,
    notes: additionalInfo || null,
    legacy_register_id: row.id,
    legacy_source: 'legacy_mysql',
    additional_info: additionalInfo,
    is_active: false,
  };
  
  context.legacyToNewMap.register.set(row.id, 0);
  
  if (phoneResult.warnings.length > 0) {
    warnings.push({
      type: 'malformed_phone',
      count: phoneResult.warnings.length,
      details: phoneResult.warnings,
      legacyTable: 'register',
      legacyField: 'telephone/mobile',
    });
  }
  if (emailResult.warnings.length > 0) {
    warnings.push({
      type: 'invalid_email',
      count: emailResult.warnings.length,
      details: emailResult.warnings,
      legacyTable: 'register',
      legacyField: 'email',
    });
  }
  if (parsedDob.warnings.length > 0) {
    warnings.push({
      type: 'invalid_date',
      count: parsedDob.warnings.length,
      details: parsedDob.warnings,
      legacyTable: 'register',
      legacyField: 'dob',
    });
  }
  if (parsedDateAd.warnings.length > 0) {
    warnings.push({
      type: 'invalid_date',
      count: parsedDateAd.warnings.length,
      details: parsedDateAd.warnings,
      legacyTable: 'register',
      legacyField: 'datebs/datead',
    });
  }
  
  context.warnings.push(...warnings);
  context.invalidRecords.push(...invalidRecords);
  
  return memberData;
}

function findDuplicateMember(
  row: LegacyRegisterRow,
  existingMembers: MigrationContext['existingMembers']
): { id: number; member_id: string; full_name: string; phone: string; email: string | null } | null {
  const name = row.name?.trim().toLowerCase();
  const phone = row.mobile?.trim() || row.telephone?.trim();
  const email = row.email?.trim().toLowerCase();
  
  for (const existing of existingMembers) {
    const existingName = existing.full_name.toLowerCase();
    const existingPhone = existing.phone.replace(/[^\d]/g, '');
    const existingEmail = existing.email?.toLowerCase();
    const cleanPhone = phone?.replace(/[^\d]/g, '');
    
    if (name && existingName === name) {
      if (cleanPhone && existingPhone && cleanPhone === existingPhone) return existing;
      if (email && existingEmail && email === existingEmail) return existing;
    }
  }
  
  return null;
}

export function migrateOfficeRegisterRow(
  row: LegacyOfficeRegisterRow,
  context: MigrationContext,
  memberIdMap: Map<number, number>
): MembershipFeeMigrationData[] {
  const results: MembershipFeeMigrationData[] = [];
  
  if (!row.reg_id || !memberIdMap.has(row.reg_id)) {
    context.missingReferences.push({
      table: 'officeregister',
      legacyId: row.id,
      referencedTable: 'register',
      referencedId: row.reg_id || 0,
    });
    return results;
  }
  
  const newMemberId = memberIdMap.get(row.reg_id)!;
  if (!newMemberId) return results;
  
  const membershipTypeResult = normalizeMembershipType(row.membershiptype);
  const statusResult = normalizeMembershipStatus(row.expdate);
  
  const parsedIssueDate = parseLegacyDate(null, row.issuedate);
  const parsedExpDate = parseLegacyDate(null, row.expdate);
  
  const additionalInfoFields: Record<string, string | null> = {};
  
  if (row.regno && !isPlaceholder(row.regno)) additionalInfoFields.regno = row.regno;
  if (row.membershipno && !isPlaceholder(row.membershipno)) additionalInfoFields.membershipno = row.membershipno;
  if (row.shift && !isPlaceholder(row.shift)) additionalInfoFields.shift = row.shift;
  if (row.fitnessgoal && !isPlaceholder(row.fitnessgoal)) additionalInfoFields.fitnessgoal = row.fitnessgoal;
  if (row.weight && !isPlaceholder(row.weight)) additionalInfoFields.weight = row.weight;
  if (row.registeredby && !isPlaceholder(row.registeredby)) additionalInfoFields.registeredby = row.registeredby;
  if (row.image && !isPlaceholder(row.image)) additionalInfoFields.image = row.image;
  if (!parsedIssueDate.isValid && row.issuedate) additionalInfoFields.legacy_issuedate = row.issuedate;
  if (!parsedExpDate.isValid && row.expdate) additionalInfoFields.legacy_expdate = row.expdate;
  
  const additionalInfo = buildAdditionalInfo(additionalInfoFields);
  
  let billingMonth: string | null = null;
  if (parsedIssueDate.adDate) {
    const [year, month] = parsedIssueDate.adDate.split('-').map(Number);
    billingMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  }
  
  let dueDate: string | null = null;
  if (parsedExpDate.adDate) {
    dueDate = parsedExpDate.adDate;
  }
  
  const feeData: MembershipFeeMigrationData = {
    member_id: newMemberId,
    billing_month: billingMonth || new Date().toISOString().split('T')[0].slice(0, 8) + '01',
    amount_minor: 0,
    currency_code: 'NPR',
    status: statusResult.status,
    paid_amount_minor: 0,
    due_date: dueDate || new Date().toISOString().split('T')[0],
    paid_at: null,
    paid_by: null,
    invoice_id: null,
    notes: additionalInfo || null,
    legacy_officeregister_id: row.id,
    legacy_source: 'legacy_mysql',
  };
  
  results.push(feeData);
  context.legacyToNewMap.officeregister.set(row.id, 0);
  
  if (parsedIssueDate.warnings.length > 0) {
    context.warnings.push({
      type: 'invalid_date',
      count: parsedIssueDate.warnings.length,
      details: parsedIssueDate.warnings,
      legacyTable: 'officeregister',
      legacyField: 'issuedate',
    });
  }
  if (parsedExpDate.warnings.length > 0) {
    context.warnings.push({
      type: 'invalid_date',
      count: parsedExpDate.warnings.length,
      details: parsedExpDate.warnings,
      legacyTable: 'officeregister',
      legacyField: 'expdate',
    });
  }
  if (!membershipTypeResult.isValid) {
    context.warnings.push({
      type: 'unknown_membership_type',
      count: 1,
      details: membershipTypeResult.warnings,
      legacyTable: 'officeregister',
      legacyField: 'membershiptype',
    });
  }
  
  return results;
}

export function migrateBillRow(
  row: LegacyBillRow,
  context: MigrationContext,
  memberIdMap: Map<number, number>
): { invoice: InvoiceMigrationData | null; payment: InvoicePaymentMigrationData | null } {
  if (!row.register_id || !memberIdMap.has(row.register_id)) {
    context.missingReferences.push({
      table: 'bill',
      legacyId: row.bill_id,
      referencedTable: 'register',
      referencedId: row.register_id || 0,
    });
    return { invoice: null, payment: null };
  }
  
  const newMemberId = memberIdMap.get(row.register_id)!;
  if (!newMemberId) return { invoice: null, payment: null };
  
  const parsedPaidDate = parseLegacyDate(null, row.paiddate);
  
  const additionalInfoFields: Record<string, string | null> = {};
  if (row.billno && !isPlaceholder(row.billno)) additionalInfoFields.billno = row.billno;
  if (row.narration && !isPlaceholder(row.narration)) additionalInfoFields.narration = row.narration;
  if (!parsedPaidDate.isValid && row.paiddate) additionalInfoFields.legacy_paiddate = row.paiddate;
  
  const additionalInfo = buildAdditionalInfo(additionalInfoFields);
  
  const amountMinor = Math.round(parseFloat(row.amount || '0') * 100);
  const toBePaidMinor = Math.round(parseFloat(row.tobepaid || '0') * 100);
  
  const paymentStatus = normalizePaymentStatus(row.tobepaid, row.amount);
  
  const billingDate = parsedPaidDate.adDate || new Date().toISOString().split('T')[0];
  const dueDate = billingDate;
  
  const invoice: InvoiceMigrationData = {
    member_ref: newMemberId,
    customer_name: '',
    customer_phone: null,
    customer_email: null,
    billing_date: billingDate,
    due_date: dueDate,
    invoice_status: 'issued',
    payment_status: paymentStatus.status,
    currency_code: 'NPR',
    subtotal_minor: amountMinor,
    discount_minor: 0,
    tax_minor: 0,
    total_minor: amountMinor,
    paid_minor: amountMinor,
    balance_minor: toBePaidMinor > amountMinor ? toBePaidMinor - amountMinor : 0,
    tax_enabled: false,
    tax_label: 'Tax',
    tax_rate_basis_points: 0,
    notes: additionalInfo || null,
    legacy_bill_id: row.bill_id,
    legacy_source: 'legacy_mysql',
    created_by: 'migration',
  };
  
  let payment: InvoicePaymentMigrationData | null = null;
  if (amountMinor > 0 && parsedPaidDate.adDate) {
    payment = {
      invoice_id: 0,
      amount_minor: amountMinor,
      payment_method: 'cash',
      payment_date: parsedPaidDate.adDate,
      reference: row.billno || null,
      notes: row.narration || null,
      is_reversal: false,
      legacy_bill_id: row.bill_id,
      legacy_source: 'legacy_mysql',
      received_by: 'migration',
    };
  }
  
  context.legacyToNewMap.bill.set(row.bill_id, 0);
  
  if (parsedPaidDate.warnings.length > 0) {
    context.warnings.push({
      type: 'invalid_date',
      count: parsedPaidDate.warnings.length,
      details: parsedPaidDate.warnings,
      legacyTable: 'bill',
      legacyField: 'paiddate',
    });
  }
  
  return { invoice, payment };
}

export function generateImportPreview(
  data: ParsedLegacyData,
  context: MigrationContext
): {
  summary: { members: number; membershipRecords: number; billingRecords: number; legacyUsers: number };
  warnings: ImportWarning[];
  invalidRecords: InvalidRecord[];
  missingReferences: MissingReference[];
  duplicateCandidates: DuplicateCandidate[];
  fieldsRequiringNotes: number;
} {
  const registerWithNotes = data.register.filter(r => 
    r.nationality || r.occupation || r.taddress || r.dob || r.datebs || r.datead
  ).length;
  
  const officeregisterWithNotes = data.officeregister.filter(r =>
    r.regno || r.membershipno || r.shift || r.fitnessgoal || r.weight || r.registeredby || r.image
  ).length;
  
  const billWithNotes = data.bill.filter(r =>
    r.billno || r.narration
  ).length;
  
  return {
    summary: {
      members: data.register.length,
      membershipRecords: data.officeregister.length,
      billingRecords: data.bill.length,
      legacyUsers: data.users.length,
    },
    warnings: context.warnings,
    invalidRecords: context.invalidRecords,
    missingReferences: context.missingReferences,
    duplicateCandidates: context.duplicateCandidates,
    fieldsRequiringNotes: registerWithNotes + officeregisterWithNotes + billWithNotes,
  };
}

export function generateFieldCompletenessReport(
  data: ParsedLegacyData
): Array<{ field: string; table: string; total: number; migrated: number; preservedInNotes: number; unresolved: number; empty: number }> {
  const report: Array<{ field: string; table: string; total: number; migrated: number; preservedInNotes: number; unresolved: number; empty: number }> = [];
  
  const registerFields: Array<{ field: RegisterField; migrated: boolean }> = [
    { field: 'name', migrated: true },
    { field: 'sex', migrated: true },
    { field: 'age', migrated: true },
    { field: 'dob', migrated: true },
    { field: 'nationality', migrated: false },
    { field: 'occupation', migrated: false },
    { field: 'telephone', migrated: true },
    { field: 'mobile', migrated: true },
    { field: 'email', migrated: true },
    { field: 'caddress', migrated: true },
    { field: 'taddress', migrated: false },
    { field: 'datebs', migrated: true },
    { field: 'datead', migrated: true },
  ];
  
  for (const f of registerFields) {
    let total = 0, empty = 0, migrated = 0, preserved = 0;
    for (const row of data.register) {
      total++;
      const value = String(row[f.field] ?? '');
      if (!value || isPlaceholder(value)) {
        empty++;
      } else if (f.migrated) {
        migrated++;
      } else {
        preserved++;
      }
    }
    report.push({ field: f.field, table: 'register', total, migrated, preservedInNotes: preserved, unresolved: 0, empty });
  }
  
  const officeregisterFields: Array<{ field: OfficeRegisterField; migrated: boolean }> = [
    { field: 'regno', migrated: false },
    { field: 'membershipno', migrated: false },
    { field: 'issuedate', migrated: true },
    { field: 'membershiptype', migrated: true },
    { field: 'expdate', migrated: true },
    { field: 'shift', migrated: false },
    { field: 'fitnessgoal', migrated: false },
    { field: 'weight', migrated: false },
    { field: 'registeredby', migrated: false },
    { field: 'image', migrated: false },
  ];
  
  for (const f of officeregisterFields) {
    let total = 0, empty = 0, migrated = 0, preserved = 0;
    for (const row of data.officeregister) {
      total++;
      const value = String(row[f.field] ?? '');
      if (!value || isPlaceholder(value)) {
        empty++;
      } else if (f.migrated) {
        migrated++;
      } else {
        preserved++;
      }
    }
    report.push({ field: f.field, table: 'officeregister', total, migrated, preservedInNotes: preserved, unresolved: 0, empty });
  }
  
  const billFields: Array<{ field: BillField; migrated: boolean }> = [
    { field: 'billno', migrated: false },
    { field: 'tobepaid', migrated: true },
    { field: 'amount', migrated: true },
    { field: 'narration', migrated: false },
    { field: 'paiddate', migrated: true },
  ];
  
  for (const f of billFields) {
    let total = 0, empty = 0, migrated = 0, preserved = 0;
    for (const row of data.bill) {
      total++;
      const value = String(row[f.field] ?? '');
      if (!value || isPlaceholder(value)) {
        empty++;
      } else if (f.migrated) {
        migrated++;
      } else {
        preserved++;
      }
    }
    report.push({ field: f.field, table: 'bill', total, migrated, preservedInNotes: preserved, unresolved: 0, empty });
  }
  
  return report;
}