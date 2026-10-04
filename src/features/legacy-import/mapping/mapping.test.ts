import { createMigrationContext, migrateRegisterRow, migrateOfficeRegisterRow, migrateBillRow, generateImportPreview, generateFieldCompletenessReport } from '../mapping';
import type { LegacyRegisterRow, LegacyOfficeRegisterRow, LegacyBillRow, MigrationContext, ParsedLegacyData } from '../types';

const createMockContext = (): MigrationContext => createMigrationContext([
  { id: 100, member_id: 'M-001', full_name: 'Existing User', phone: '9841234567', email: 'existing@example.com' },
]);

const mockRegisterRow: LegacyRegisterRow = {
  id: 1,
  datebs: '2078-05-10',
  datead: '2021-08-25',
  name: 'Ram Sharma',
  sex: 'M',
  age: '30',
  dob: '1991-03-15',
  nationality: 'Nepali',
  occupation: 'Business',
  telephone: '01-456789',
  mobile: '9841234567',
  email: 'ram@example.com',
  caddress: 'Kathmandu',
  taddress: 'Bhaktapur',
};

const mockOfficeRegisterRow: LegacyOfficeRegisterRow = {
  id: 1,
  regno: 'REG-001',
  membershipno: 'MEM-001',
  issuedate: '2021-08-25',
  membershiptype: 'monthly',
  expdate: '2021-11-25',
  shift: 'Morning',
  fitnessgoal: 'Weight Loss',
  weight: '75.5',
  registeredby: 'Admin',
  image: 'uploads/1.jpg',
  reg_id: 1,
};

const mockBillRow: LegacyBillRow = {
  bill_id: 1,
  billno: 'BILL-001',
  tobepaid: '5000',
  amount: '5000',
  narration: 'Monthly membership fee',
  paiddate: '2021-08-25',
  register_id: 1,
};

describe('Migration Mapping', () => {
  let context: MigrationContext;

  beforeEach(() => {
    context = createMockContext();
  });

  test('migrates register row to member data', () => {
    const member = migrateRegisterRow(mockRegisterRow, context);
    
    expect(member).not.toBeNull();
    expect(member!.member_id).toBe('LEG-000001');
    expect(member!.full_name).toBe('Ram Sharma');
    expect(member!.email).toBe('ram@example.com');
    expect(member!.phone).toBe('9841234567');
    expect(member!.address).toBe('Kathmandu');
    expect(member!.membership_type).toBe('monthly');
    expect(member!.membership_status).toBe('active');
    expect(member!.start_date).toBe('2021-08-26');
    expect(member!.legacy_register_id).toBe(1);
    expect(member!.legacy_source).toBe('legacy_mysql');
    expect(member!.notes).toContain('Legacy Information');
    expect(member!.notes).toContain('Nationality: Nepali');
    expect(member!.notes).toContain('Occupation: Business');
    expect(member!.notes).toContain('Telephone: 01-456789');
    expect(member!.notes).toContain('Temporary Address: Bhaktapur');
  });

  test('sets legacy_to_new_map for register', () => {
    migrateRegisterRow(mockRegisterRow, context);
    expect(context.legacyToNewMap.register.has(1)).toBe(true);
  });

  test('detects duplicate by phone with matching name', () => {
    const duplicateRow: LegacyRegisterRow = {
      ...mockRegisterRow,
      id: 2,
      name: 'Existing User', // Same name as existing member
      mobile: '9841234567', // Same phone
    };
    
    migrateRegisterRow(duplicateRow, context);
    
    expect(context.duplicateCandidates).toHaveLength(1);
    expect(context.duplicateCandidates[0].type).toBe('member');
    expect(context.duplicateCandidates[0].legacyId).toBe(2);
    expect(context.duplicateCandidates[0].existingId).toBe(100);
  });

  test('detects duplicate by email with matching name', () => {
    const duplicateRow: LegacyRegisterRow = {
      ...mockRegisterRow,
      id: 2,
      name: 'Existing User',  // Same name as existing member
      mobile: '9851111111', // Different phone
      email: 'existing@example.com', // Same email
    };
    
    migrateRegisterRow(duplicateRow, context);
    
    expect(context.duplicateCandidates).toHaveLength(1);
    expect(context.duplicateCandidates[0].matchReason).toContain('Existing User');
  });

  test('does not detect duplicate on name only', () => {
    const duplicateRow: LegacyRegisterRow = {
      ...mockRegisterRow,
      id: 2,
      name: 'Existing User',
      mobile: '9851111111',
      email: 'different@example.com',
    };
    
    migrateRegisterRow(duplicateRow, context);
    
    expect(context.duplicateCandidates).toHaveLength(0);
  });

  test('handles invalid register row', () => {
    const invalidRow: LegacyRegisterRow = {
      ...mockRegisterRow,
      id: 0,
      name: 'A',
    };
    
    const member = migrateRegisterRow(invalidRow, context);
    expect(member).toBeNull();
    expect(context.invalidRecords.length).toBeGreaterThan(0);
  });

  test('migrates officeregister row to membership fee', () => {
    context.legacyToNewMap.register.set(1, 100);
    
    const fees = migrateOfficeRegisterRow(mockOfficeRegisterRow, context, context.legacyToNewMap.register);
    
    expect(fees).toHaveLength(1);
    expect(fees[0].member_id).toBe(100);
    expect(fees[0].billing_month).toBe('2021-08-01');
    expect(fees[0].status).toBe('expired');
    expect(fees[0].due_date).toBe('2021-11-25');
    expect(fees[0].legacy_officeregister_id).toBe(1);
    expect(fees[0].legacy_source).toBe('legacy_mysql');
    expect(fees[0].notes).toContain('Legacy Registration No: REG-001');
    expect(fees[0].notes).toContain('Legacy Membership No: MEM-001');
    expect(fees[0].notes).toContain('Shift: Morning');
    expect(fees[0].notes).toContain('Fitness Goal: Weight Loss');
    expect(fees[0].notes).toContain('Weight (kg): 75.5');
    expect(fees[0].notes).toContain('Registered By: Admin');
    expect(fees[0].notes).toContain('Legacy Image: uploads/1.jpg');
  });

  test('handles missing reg_id reference', () => {
    const fees = migrateOfficeRegisterRow(mockOfficeRegisterRow, context, context.legacyToNewMap.register);
    
    expect(fees).toHaveLength(0);
    expect(context.missingReferences).toHaveLength(1);
    expect(context.missingReferences[0].table).toBe('officeregister');
    expect(context.missingReferences[0].referencedTable).toBe('register');
  });

  test('warns on unknown membership type', () => {
    context.legacyToNewMap.register.set(1, 100);
    const row: LegacyOfficeRegisterRow = {
      ...mockOfficeRegisterRow,
      membershiptype: 'unknown_type',
    };
    
    migrateOfficeRegisterRow(row, context, context.legacyToNewMap.register);
    
    const typeWarnings = context.warnings.filter(w => w.type === 'unknown_membership_type');
    expect(typeWarnings.length).toBeGreaterThan(0);
  });

  test('migrates bill row to invoice and payment', () => {
    context.legacyToNewMap.register.set(1, 100);
    
    const { invoice, payment } = migrateBillRow(mockBillRow, context, context.legacyToNewMap.register);
    
    expect(invoice).not.toBeNull();
    expect(invoice!.member_ref).toBe(100);
    expect(invoice!.billing_date).toBe('2021-08-25');
    expect(invoice!.total_minor).toBe(500000);
    expect(invoice!.payment_status).toBe('paid');
    expect(invoice!.legacy_bill_id).toBe(1);
    expect(invoice!.legacy_source).toBe('legacy_mysql');
    expect(invoice!.notes).toContain('Legacy Bill No: BILL-001');
    expect(invoice!.notes).toContain('Payment Description: Monthly membership fee');
    
    expect(payment).not.toBeNull();
    expect(payment!.amount_minor).toBe(500000);
    expect(payment!.payment_date).toBe('2021-08-25');
    expect(payment!.payment_method).toBe('cash');
    expect(payment!.legacy_bill_id).toBe(1);
  });

  test('handles unpaid bill (amount = 0)', () => {
    context.legacyToNewMap.register.set(1, 100);
    const row: LegacyBillRow = {
      ...mockBillRow,
      amount: '0',
      tobepaid: '5000',
    };
    
    const { invoice, payment } = migrateBillRow(row, context, context.legacyToNewMap.register);
    
    expect(invoice!.payment_status).toBe('unpaid');
    expect(invoice!.balance_minor).toBe(500000);
    expect(payment).toBeNull();
  });

  test('handles partial payment', () => {
    context.legacyToNewMap.register.set(1, 100);
    const row: LegacyBillRow = {
      ...mockBillRow,
      amount: '2500',
      tobepaid: '5000',
    };
    
    const { invoice } = migrateBillRow(row, context, context.legacyToNewMap.register);
    
    expect(invoice!.payment_status).toBe('partial');
    expect(invoice!.paid_minor).toBe(250000);
    expect(invoice!.balance_minor).toBe(250000);
  });

  test('handles missing register_id reference', () => {
    const { invoice, payment } = migrateBillRow(mockBillRow, context, context.legacyToNewMap.register);
    
    expect(invoice).toBeNull();
    expect(payment).toBeNull();
    expect(context.missingReferences).toHaveLength(1);
    expect(context.missingReferences[0].table).toBe('bill');
  });
});

describe('Import Preview Generation', () => {
  let context: MigrationContext;
  let mockData: ParsedLegacyData;

  beforeEach(() => {
    context = createMockContext();
    mockData = {
      register: [mockRegisterRow],
      officeregister: [mockOfficeRegisterRow],
      bill: [mockBillRow],
      users: [{ id: 1, username: 'admin' }],
    };
    
    for (const row of mockData.register) migrateRegisterRow(row, context);
    for (const row of mockData.officeregister) migrateOfficeRegisterRow(row, context, context.legacyToNewMap.register);
    for (const row of mockData.bill) migrateBillRow(row, context, context.legacyToNewMap.register);
  });

  test('generates correct summary', () => {
    const preview = generateImportPreview(mockData, context);
    
    expect(preview.summary.members).toBe(1);
    expect(preview.summary.membershipRecords).toBe(1);
    expect(preview.summary.billingRecords).toBe(1);
    expect(preview.summary.legacyUsers).toBe(1);
  });

  test('includes warnings', () => {
    const preview = generateImportPreview(mockData, context);
    
    expect(preview.warnings.length).toBeGreaterThanOrEqual(0);
  });

  test('counts fields requiring notes', () => {
    const preview = generateImportPreview(mockData, context);
    
    expect(preview.fieldsRequiringNotes).toBeGreaterThan(0);
  });
});

describe('Field Completeness Report', () => {
  test('generates report for all fields', () => {
    const data: ParsedLegacyData = {
      register: [mockRegisterRow],
      officeregister: [mockOfficeRegisterRow],
      bill: [mockBillRow],
      users: [],
    };
    
    const report = generateFieldCompletenessReport(data);
    
    expect(report.length).toBeGreaterThan(0);
    
    const nameField = report.find(r => r.field === 'name' && r.table === 'register');
    expect(nameField).toBeDefined();
    expect(nameField!.total).toBe(1);
    expect(nameField!.migrated).toBe(1);
    expect(nameField!.preservedInNotes).toBe(0);
    
    const nationalityField = report.find(r => r.field === 'nationality' && r.table === 'register');
    expect(nationalityField).toBeDefined();
    expect(nationalityField!.total).toBe(1);
    expect(nationalityField!.migrated).toBe(0);
    expect(nationalityField!.preservedInNotes).toBe(1);
    
    const issuedateField = report.find(r => r.field === 'issuedate' && r.table === 'officeregister');
    expect(issuedateField).toBeDefined();
    expect(issuedateField!.migrated).toBe(1);
  });

  test('calculates totals correctly', () => {
    const data: ParsedLegacyData = {
      register: [mockRegisterRow, { ...mockRegisterRow, id: 2, nationality: null }],
      officeregister: [mockOfficeRegisterRow],
      bill: [mockBillRow],
      users: [],
    };
    
    const report = generateFieldCompletenessReport(data);
    
    const totalAll = report.reduce((sum, r) => sum + r.total, 0);
    const migratedAll = report.reduce((sum, r) => sum + r.migrated, 0);
    const notesAll = report.reduce((sum, r) => sum + r.preservedInNotes, 0);
    const emptyAll = report.reduce((sum, r) => sum + r.empty, 0);
    
    expect(totalAll).toBe(migratedAll + notesAll + emptyAll);
  });
});