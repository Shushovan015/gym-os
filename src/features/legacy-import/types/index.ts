export interface LegacyRegisterRow {
  id: number;
  datebs: string | null;
  datead: string | null;
  name: string | null;
  sex: string | null;
  age: string | null;
  dob: string | null;
  nationality: string | null;
  occupation: string | null;
  telephone: string | null;
  mobile: string | null;
  email: string | null;
  caddress: string | null;
  taddress: string | null;
}

export interface LegacyOfficeRegisterRow {
  id: number;
  regno: string | null;
  membershipno: string | null;
  issuedate: string | null;
  membershiptype: string | null;
  expdate: string | null;
  shift: string | null;
  fitnessgoal: string | null;
  weight: string | null;
  registeredby: string | null;
  image: string | null;
  reg_id: number | null;
}

export interface LegacyBillRow {
  bill_id: number;
  billno: string | null;
  tobepaid: string | null;
  amount: string | null;
  narration: string | null;
  paiddate: string | null;
  register_id: number | null;
}

export type RegisterField = keyof LegacyRegisterRow;
export type OfficeRegisterField = keyof LegacyOfficeRegisterRow;
export type BillField = keyof LegacyBillRow;

export interface LegacyUserRow {
  id: number;
  username: string | null;
  password: string | null;
  name: string | null;
  time: string | null;
}

export interface ParsedLegacyData {
  register: LegacyRegisterRow[];
  officeregister: LegacyOfficeRegisterRow[];
  bill: LegacyBillRow[];
  users: LegacyUserRow[];
}

export interface MigrationMapping {
  legacyTable: string;
  legacyField: string;
  newTable: string;
  newField: string;
  transformation: 'direct' | 'normalized' | 'derived' | 'additional_info' | 'skip';
  fallbackAction: 'additional_info' | 'discard' | 'preserve_original';
  notes?: string;
}

export interface FieldCompletenessReport {
  field: string;
  table: string;
  total: number;
  migrated: number;
  preservedInNotes: number;
  unresolved: number;
  empty: number;
}

export interface ImportPreview {
  summary: {
    members: number;
    membershipRecords: number;
    billingRecords: number;
    legacyUsers: number;
  };
  warnings: ImportWarning[];
  invalidRecords: InvalidRecord[];
  missingReferences: MissingReference[];
  duplicateCandidates: DuplicateCandidate[];
  fieldsRequiringNotes: number;
}

export interface ImportWarning {
  type: 'invalid_date' | 'malformed_phone' | 'invalid_email' | 'missing_reference' | 'duplicate_candidate' | 'malformed_number' | 'unknown_membership_type';
  count: number;
  details: string[];
  legacyTable: string;
  legacyField: string;
}

export interface InvalidRecord {
  table: string;
  legacyId: number | string;
  field: string;
  value: string;
  reason: string;
}

export interface MissingReference {
  table: string;
  legacyId: number;
  referencedTable: string;
  referencedId: number;
}

export interface DuplicateCandidate {
  type: 'member' | 'membership' | 'bill';
  legacyId: number;
  existingId: number;
  matchReason: string;
  legacyData: Record<string, unknown>;
  existingData: Record<string, unknown>;
}

export interface LegacyToNewIdMap {
  register: Map<number, number>;
  officeregister: Map<number, number>;
  bill: Map<number, number>;
}

export interface MigrationResult {
  success: boolean;
  membersImported: number;
  membershipsImported: number;
  paymentsImported: number;
  warnings: ImportWarning[];
  errors: string[];
  skippedRecords: number;
  preservedInNotesCount: number;
  importLogId?: number;
}

export interface ImportLogEntry {
  id?: number;
  fileName: string;
  importDate: string;
  membersFound: number;
  membersImported: number;
  membershipsImported: number;
  billsImported: number;
  warnings: number;
  errors: number;
  skippedRecords: number;
  preservedInNotes: number;
  status: 'completed' | 'failed' | 'partial';
  errorDetails?: string;
}

export interface MemberMigrationData {
  member_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  photo_url: string | null;
  membership_type: string;
  membership_status: string;
  start_date: string | null;
  end_date: string | null;
  last_visit_date: string | null;
  payment_status: string;
  payment_due_date: string | null;
  notes: string | null;
  legacy_register_id: number;
  legacy_source: string;
  additional_info: string;
  is_active: boolean;
}

export interface MembershipFeeMigrationData {
  member_id: number;
  billing_month: string;
  amount_minor: number;
  currency_code: string;
  status: string;
  paid_amount_minor: number;
  due_date: string;
  paid_at: string | null;
  paid_by: string | null;
  invoice_id: number | null;
  notes: string | null;
  legacy_officeregister_id: number;
  legacy_source: string;
}

export interface InvoiceMigrationData {
  member_ref: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  billing_date: string;
  due_date: string | null;
  invoice_status: string;
  payment_status: string;
  currency_code: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  paid_minor: number;
  balance_minor: number;
  tax_enabled: boolean;
  tax_label: string;
  tax_rate_basis_points: number;
  notes: string | null;
  legacy_bill_id: number;
  legacy_source: string;
  created_by: string;
}

export interface InvoicePaymentMigrationData {
  invoice_id: number;
  amount_minor: number;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  is_reversal: boolean;
  legacy_bill_id: number;
  legacy_source: string;
  received_by: string;
}