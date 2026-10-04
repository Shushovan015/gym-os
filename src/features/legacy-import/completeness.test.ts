import { parseLegacySQLDump } from './parser/sqlParser';
import { generateFieldCompletenessReport } from './mapping';
import { isPlaceholder } from './normalizer';

const FULL_LEGACY_DUMP = `
INSERT INTO \`register\` (\`id\`, \`datebs\`, \`datead\`, \`name\`, \`sex\`, \`age\`, \`dob\`, \`nationality\`, \`occupation\`, \`telephone\`, \`mobile\`, \`email\`, \`caddress\`, \`taddress\`) VALUES
(1, '2078-05-10', '2021-08-25', 'Ram Sharma', 'M', '30', '1991-03-15', 'Nepali', 'Business', '01-456789', '9841234567', 'ram@example.com', 'Kathmandu', 'Bhaktapur'),
(2, '2079-01-15', '2022-04-28', 'Sita Devi', 'F', '25', '1997-08-10', 'Nepali', 'Teacher', '01-567890', '9851234567', 'sita@example.com', 'Lalitpur', 'Kathmandu'),
(3, '2080-03-20', '2023-07-05', 'Hari Bahadur', 'M', '35', '00000', 'Nepali', 'Engineer', '01-678901', '9861234567', 'hari@example.com', 'Pokhara', ''),
(4, '2081-06-10', '2024-09-22', 'Gita Kumari', 'F', '28', '1996-02-20', '000', 'Doctor', '01-789012', '9871234567', 'gita@example.com', 'Biratnagar', 'Dharan');

INSERT INTO \`officeregister\` (\`id\`, \`regno\`, \`membershipno\`, \`issuedate\`, \`membershiptype\`, \`expdate\`, \`shift\`, \`fitnessgoal\`, \`weight\`, \`registeredby\`, \`image\`, \`reg_id\`) VALUES
(1, 'REG-001', 'MEM-001', '2021-08-25', 'monthly', '2021-11-25', 'Morning', 'Weight Loss', '75.5', 'Admin', 'uploads/1.jpg', 1),
(2, 'REG-002', 'MEM-002', '2022-04-28', 'quarterly', '2022-07-28', 'Evening', 'Muscle Gain', '70.0', 'Admin', 'uploads/2.jpg', 2),
(3, 'REG-003', 'MEM-003', '2023-07-05', 'yearly', '2024-07-05', 'Morning', 'Fitness', '80.0', 'Trainer', 'uploads/3.jpg', 3),
(4, 'REG-004', 'MEM-004', '2024-09-22', 'monthly', '2024-12-22', 'Evening', 'Wellness', '65.0', 'Admin', 'uploads/4.jpg', 4);

INSERT INTO \`bill\` (\`bill_id\`, \`billno\`, \`tobepaid\`, \`amount\`, \`narration\`, \`paiddate\`, \`register_id\`) VALUES
(1, 'BILL-001', '5000', '5000', 'Monthly membership fee', '2021-08-25', 1),
(2, 'BILL-002', '15000', '10000', 'Quarterly fee - partial', '2022-04-28', 2),
(3, 'BILL-003', '20000', '0', 'Yearly fee - unpaid', NULL, 3),
(4, 'BILL-004', '5000', '5000', 'Monthly fee', '2024-09-22', 4);

INSERT INTO \`users\` (\`id\`, \`username\`, \`password\`, \`name\`, \`time\`) VALUES
(1, 'admin', 'hash123', 'Admin User', '2021-01-01 10:00:00');
`;

describe('Lossless Migration Completeness', () => {
  let parsedData: ReturnType<typeof parseLegacySQLDump>;

  beforeAll(() => {
    parsedData = parseLegacySQLDump(FULL_LEGACY_DUMP);
  });

  test('parses all legacy tables', () => {
    expect(parsedData.register).toHaveLength(4);
    expect(parsedData.officeregister).toHaveLength(4);
    expect(parsedData.bill).toHaveLength(4);
    expect(parsedData.users).toHaveLength(1);
  });

  test('every non-empty register field has a destination', () => {
    const report = generateFieldCompletenessReport(parsedData);
    const registerFields = report.filter(r => r.table === 'register');
    
    for (const field of registerFields) {
      const meaningfulCount = field.total - field.empty;
      const preservedCount = field.migrated + field.preservedInNotes;
      
      expect(preservedCount).toBe(meaningfulCount);
    }
  });

  test('every non-empty officeregister field has a destination', () => {
    const report = generateFieldCompletenessReport(parsedData);
    const officeFields = report.filter(r => r.table === 'officeregister');
    
    for (const field of officeFields) {
      const meaningfulCount = field.total - field.empty;
      const preservedCount = field.migrated + field.preservedInNotes;
      
      expect(preservedCount).toBe(meaningfulCount);
    }
  });

  test('every non-empty bill field has a destination', () => {
    const report = generateFieldCompletenessReport(parsedData);
    const billFields = report.filter(r => r.table === 'bill');
    
    for (const field of billFields) {
      const meaningfulCount = field.total - field.empty;
      const preservedCount = field.migrated + field.preservedInNotes;
      
      expect(preservedCount).toBe(meaningfulCount);
    }
  });

  test('register: name, sex, age, dob, email, caddress, datebs, datead, telephone, mobile are migrated', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    const migratedFields = ['name', 'sex', 'age', 'dob', 'email', 'caddress', 'datebs', 'datead', 'telephone', 'mobile'];
    
    for (const fieldName of migratedFields) {
      const field = report.find(r => r.field === fieldName && r.table === 'register');
      expect(field).toBeDefined();
      expect(field!.migrated).toBeGreaterThan(0);
    }
  });

  test('register: nationality, occupation, taddress are preserved in notes', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    const notesFields = ['nationality', 'occupation', 'taddress'];
    
    for (const fieldName of notesFields) {
      const field = report.find(r => r.field === fieldName && r.table === 'register');
      expect(field).toBeDefined();
      expect(field!.preservedInNotes).toBeGreaterThan(0);
    }
  });

  test('officeregister: issuedate, membershiptype, expdate are migrated', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    const migratedFields = ['issuedate', 'membershiptype', 'expdate'];
    
    for (const fieldName of migratedFields) {
      const field = report.find(r => r.field === fieldName && r.table === 'officeregister');
      expect(field).toBeDefined();
      expect(field!.migrated).toBeGreaterThan(0);
    }
  });

  test('officeregister: regno, membershipno, shift, fitnessgoal, weight, registeredby, image are preserved in notes', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    const notesFields = ['regno', 'membershipno', 'shift', 'fitnessgoal', 'weight', 'registeredby', 'image'];
    
    for (const fieldName of notesFields) {
      const field = report.find(r => r.field === fieldName && r.table === 'officeregister');
      expect(field).toBeDefined();
      expect(field!.preservedInNotes).toBeGreaterThan(0);
    }
  });

  test('bill: billno, narration are preserved in notes', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    const notesFields = ['billno', 'narration'];
    
    for (const fieldName of notesFields) {
      const field = report.find(r => r.field === fieldName && r.table === 'bill');
      expect(field).toBeDefined();
      expect(field!.preservedInNotes).toBeGreaterThan(0);
    }
  });

  test('bill: tobepaid, amount, paiddate are migrated', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    const migratedFields = ['tobepaid', 'amount', 'paiddate'];
    
    for (const fieldName of migratedFields) {
      const field = report.find(r => r.field === fieldName && r.table === 'bill');
      expect(field).toBeDefined();
      expect(field!.migrated).toBeGreaterThan(0);
    }
  });

  test('no field has unresolved values', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    for (const field of report) {
      expect(field.unresolved).toBe(0);
    }
  });

  test('overall completeness is 100% for meaningful values', () => {
    const report = generateFieldCompletenessReport(parsedData);
    
    const totalMeaningful = report.reduce((sum, r) => sum + r.total - r.empty, 0);
    const totalPreserved = report.reduce((sum, r) => sum + r.migrated + r.preservedInNotes, 0);
    
    expect(totalPreserved).toBe(totalMeaningful);
    expect(totalMeaningful).toBeGreaterThan(0);
  });

  test('placeholder values are correctly identified as empty', () => {
    expect(isPlaceholder('00000')).toBe(true);
    expect(isPlaceholder('000')).toBe(true);
    expect(isPlaceholder('nil')).toBe(true);
    expect(isPlaceholder('N/A')).toBe(true);
    expect(isPlaceholder('')).toBe(true);
  });

  test('real values are not treated as placeholders', () => {
    expect(isPlaceholder('Nepali')).toBe(false);
    expect(isPlaceholder('Business')).toBe(false);
    expect(isPlaceholder('9841234567')).toBe(false);
    expect(isPlaceholder('2021-08-25')).toBe(false);
    expect(isPlaceholder('0')).toBe(true); // all zeros treated as placeholder
    expect(isPlaceholder('0.0')).toBe(false); // not all zeros
  });
});

describe('Data Integrity Invariant', () => {
  test('every meaningful legacy value is traceable in new system', () => {
    const parsedData = parseLegacySQLDump(FULL_LEGACY_DUMP);
    const report = generateFieldCompletenessReport(parsedData);
    
    for (const field of report) {
      const meaningful = field.total - field.empty;
      const accounted = field.migrated + field.preservedInNotes;
      
      expect(accounted).toBe(meaningful);
    }
  });

  test('legacy ID relationships are preserved', () => {
    const parsedData = parseLegacySQLDump(FULL_LEGACY_DUMP);
    console.log('Register IDs:', parsedData.register.map(r => r.id));
    console.log('Officeregister reg_ids:', parsedData.officeregister.map(o => o.reg_id));
    console.log('Bill register_ids:', parsedData.bill.map(b => b.register_id));
    
    for (const office of parsedData.officeregister) {
      expect(office.reg_id).toBeDefined();
      expect(office.reg_id).toBeGreaterThan(0);
      
      const matchingRegister = parsedData.register.find(r => r.id === office.reg_id);
      expect(matchingRegister).toBeDefined();
    }
    
    for (const bill of parsedData.bill) {
      expect(bill.register_id).toBeDefined();
      expect(bill.register_id).toBeGreaterThan(0);
      
      const matchingRegister = parsedData.register.find(r => r.id === bill.register_id);
      expect(matchingRegister).toBeDefined();
    }
  });

  test('no data is silently discarded - all tables accounted', () => {
    const parsedData = parseLegacySQLDump(FULL_LEGACY_DUMP);
    const report = generateFieldCompletenessReport(parsedData);
    
    const tables = ['register', 'officeregister', 'bill'];
    
    for (const table of tables) {
      const tableFields = report.filter(r => r.table === table);
      const tableTotal = tableFields.reduce((sum, r) => sum + r.total, 0);
      const tableEmpty = tableFields.reduce((sum, r) => sum + r.empty, 0);
      const tableMeaningful = tableTotal - tableEmpty;
      const tableAccounted = tableFields.reduce((sum, r) => sum + r.migrated + r.preservedInNotes, 0);
      
      expect(tableAccounted).toBe(tableMeaningful);
    }
  });
});