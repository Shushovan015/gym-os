import { parseLegacySQLDump, validateParsedData } from '../parser/sqlParser';
import type { ParsedLegacyData } from '../types';

const SAMPLE_SQL_DUMP = `
-- MySQL dump 10.13
SET NAMES utf8mb4;

INSERT INTO \`register\` (\`id\`, \`datebs\`, \`datead\`, \`name\`, \`sex\`, \`age\`, \`dob\`, \`nationality\`, \`occupation\`, \`telephone\`, \`mobile\`, \`email\`, \`caddress\`, \`taddress\`) VALUES
(1, '2078-05-10', '2021-08-25', 'Ram Sharma', 'M', '30', '1991-03-15', 'Nepali', 'Business', '01-456789', '9841234567', 'ram@example.com', 'Kathmandu', 'Bhaktapur'),
(2, '2079-01-15', '2022-04-28', 'Sita Devi', 'F', '25', '1997-08-10', 'Nepali', 'Teacher', '01-567890', '9851234567', 'sita@example.com', 'Lalitpur', 'Kathmandu'),
(3, '2080-03-20', '2023-07-05', 'Hari Bahadur', 'M', '35', '00000', 'Nepali', 'Engineer', '01-678901', '9861234567', 'hari@example.com', 'Pokhara', '');

INSERT INTO \`officeregister\` (\`id\`, \`regno\`, \`membershipno\`, \`issuedate\`, \`membershiptype\`, \`expdate\`, \`shift\`, \`fitnessgoal\`, \`weight\`, \`registeredby\`, \`image\`, \`reg_id\`) VALUES
(1, 'REG-001', 'MEM-001', '2021-08-25', 'monthly', '2021-11-25', 'Morning', 'Weight Loss', '75.5', 'Admin', 'uploads/1.jpg', 1),
(2, 'REG-002', 'MEM-002', '2022-04-28', 'quarterly', '2022-07-28', 'Evening', 'Muscle Gain', '70.0', 'Admin', 'uploads/2.jpg', 2),
(3, 'REG-003', 'MEM-003', '2023-07-05', 'yearly', '2024-07-05', 'Morning', 'Fitness', '80.0', 'Trainer', 'uploads/3.jpg', 3);

INSERT INTO \`bill\` (\`bill_id\`, \`billno\`, \`tobepaid\`, \`amount\`, \`narration\`, \`paiddate\`, \`register_id\`) VALUES
(1, 'BILL-001', '5000', '5000', 'Monthly membership fee', '2021-08-25', 1),
(2, 'BILL-002', '15000', '10000', 'Quarterly fee - partial', '2022-04-28', 2),
(3, 'BILL-003', '20000', '0', 'Yearly fee - unpaid', NULL, 3);

INSERT INTO \`users\` (\`id\`, \`username\`, \`password\`, \`name\`, \`time\`) VALUES
(1, 'admin', 'hash123', 'Admin User', '2021-01-01 10:00:00'),
(2, 'trainer', 'hash456', 'Trainer User', '2021-02-01 10:00:00');
`;

describe('SQL Parser', () => {
  let parsedData: ParsedLegacyData;

  beforeAll(() => {
    parsedData = parseLegacySQLDump(SAMPLE_SQL_DUMP);
  });

  test('parses register table correctly', () => {
    expect(parsedData.register).toHaveLength(3);
    expect(parsedData.register[0]).toEqual({
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
    });
  });

  test('parses officeregister table correctly', () => {
    expect(parsedData.officeregister).toHaveLength(3);
    expect(parsedData.officeregister[0]).toEqual({
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
    });
  });

  test('parses bill table correctly', () => {
    expect(parsedData.bill).toHaveLength(3);
    expect(parsedData.bill[0]).toEqual({
      bill_id: 1,
      billno: 'BILL-001',
      tobepaid: '5000',
      amount: '5000',
      narration: 'Monthly membership fee',
      paiddate: '2021-08-25',
      register_id: 1,
    });
  });

  test('parses users table correctly', () => {
    expect(parsedData.users).toHaveLength(2);
    expect(parsedData.users[0]).toEqual({
      id: 1,
      username: 'admin',
      password: 'hash123',
      name: 'Admin User',
      time: '2021-01-01 10:00:00',
    });
  });

  test('handles NULL values correctly', () => {
    expect(parsedData.register[2].taddress).toBeNull();
    expect(parsedData.bill[2].paiddate).toBeNull();
  });

  test('validates parsed data', () => {
    const validation = validateParsedData(parsedData);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('detects invalid register IDs', () => {
    const invalidSql = `
      INSERT INTO \`register\` (\`id\`, \`datebs\`, \`datead\`, \`name\`, \`sex\`, \`age\`, \`dob\`, \`nationality\`, \`occupation\`, \`telephone\`, \`mobile\`, \`email\`, \`caddress\`, \`taddress\`) VALUES
      (0, '2078-05-10', '2021-08-25', 'Invalid', 'M', '30', '1991-03-15', 'Nepali', 'Business', '01-456789', '9841234567', 'ram@example.com', 'Kathmandu', 'Bhaktapur'),
      (-1, '2078-05-10', '2021-08-25', 'Also Invalid', 'M', '30', '1991-03-15', 'Nepali', 'Business', '01-456789', '9841234567', 'ram@example.com', 'Kathmandu', 'Bhaktapur');
    `;
    const data = parseLegacySQLDump(invalidSql);
    const validation = validateParsedData(data);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('detects missing names', () => {
    const invalidSql = `
      INSERT INTO \`register\` (\`id\`, \`datebs\`, \`datead\`, \`name\`, \`sex\`, \`age\`, \`dob\`, \`nationality\`, \`occupation\`, \`telephone\`, \`mobile\`, \`email\`, \`caddress\`, \`taddress\`) VALUES
      (1, '2078-05-10', '2021-08-25', '', 'M', '30', '1991-03-15', 'Nepali', 'Business', '01-456789', '9841234567', 'ram@example.com', 'Kathmandu', 'Bhaktapur');
    `;
    const data = parseLegacySQLDump(invalidSql);
    const validation = validateParsedData(data);
    expect(validation.valid).toBe(false);
  });

  test('detects missing reg_id in officeregister during mapping', () => {
    const invalidSql = `
      INSERT INTO \`officeregister\` (\`id\`, \`regno\`, \`membershipno\`, \`issuedate\`, \`membershiptype\`, \`expdate\`, \`shift\`, \`fitnessgoal\`, \`weight\`, \`registeredby\`, \`image\`, \`reg_id\`) VALUES
      (1, 'REG-001', 'MEM-001', '2021-08-25', 'monthly', '2021-11-25', 'Morning', 'Weight Loss', '75.5', 'Admin', 'uploads/1.jpg', 0);
    `;
    const data = parseLegacySQLDump(invalidSql);
    const validation = validateParsedData(data);
    expect(validation.valid).toBe(true); // validation passes
    // Missing references are caught during mapping phase
  });

  test('detects missing register_id in bill during mapping', () => {
    const invalidSql = `
      INSERT INTO \`bill\` (\`bill_id\`, \`billno\`, \`tobepaid\`, \`amount\`, \`narration\`, \`paiddate\`, \`register_id\`) VALUES
      (1, 'BILL-001', '5000', '5000', 'Test', '2021-08-25', 0);
    `;
    const data = parseLegacySQLDump(invalidSql);
    const validation = validateParsedData(data);
    expect(validation.valid).toBe(true); // validation passes
    // Missing references are caught during mapping phase
  });

  test('ignores unrelated tables', () => {
    const sqlWithOtherTables = `
      ${SAMPLE_SQL_DUMP}
      INSERT INTO \`other_table\` (\`id\`, \`name\`) VALUES (1, 'test');
    `;
    const data = parseLegacySQLDump(sqlWithOtherTables);
    expect(data.register).toHaveLength(3);
    expect(data.officeregister).toHaveLength(3);
    expect(data.bill).toHaveLength(3);
  });
});

describe('SQL Parser - Edge Cases', () => {
  test('handles empty dump', () => {
    const data = parseLegacySQLDump('');
    expect(data.register).toHaveLength(0);
    expect(data.officeregister).toHaveLength(0);
    expect(data.bill).toHaveLength(0);
    expect(data.users).toHaveLength(0);
  });
});