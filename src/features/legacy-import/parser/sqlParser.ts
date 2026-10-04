import type { ParsedLegacyData, LegacyRegisterRow, LegacyOfficeRegisterRow, LegacyBillRow, LegacyUserRow } from '../types';

const TARGET_TABLES = ['register', 'officeregister', 'bill', 'users'] as const;
type TargetTable = typeof TARGET_TABLES[number];

interface TableSchema {
  name: TargetTable;
  columns: string[];
}

const TABLE_SCHEMAS: Record<TargetTable, TableSchema> = {
  register: {
    name: 'register',
    columns: ['id', 'datebs', 'datead', 'name', 'sex', 'age', 'dob', 'nationality', 'occupation', 'telephone', 'mobile', 'email', 'caddress', 'taddress'],
  },
  officeregister: {
    name: 'officeregister',
    columns: ['id', 'regno', 'membershipno', 'issuedate', 'membershiptype', 'expdate', 'shift', 'fitnessgoal', 'weight', 'registeredby', 'image', 'reg_id'],
  },
  bill: {
    name: 'bill',
    columns: ['bill_id', 'billno', 'tobepaid', 'amount', 'narration', 'paiddate', 'register_id'],
  },
  users: {
    name: 'users',
    columns: ['id', 'username', 'password', 'name', 'time'],
  },
};

function parseMySQLValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === 'NULL' || trimmed === 'null') return '';
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
}

function splitInsertValues(valuesStr: string): string[] {
  const results: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let i = 0;

  while (i < valuesStr.length) {
    const char = valuesStr[i];
    const nextChar = valuesStr[i + 1];

    if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      if (nextChar === quoteChar) {
        current += char + char;
        i += 2;
        continue;
      } else if (char === '\\' && nextChar) {
        current += char + nextChar;
        i += 2;
        continue;
      } else {
        inQuotes = false;
        current += char;
      }
    } else if (!inQuotes && char === ',') {
      results.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }

  if (current.trim()) {
    results.push(current.trim());
  }

  return results;
}

function parseInsertStatement(sql: string, tableName: TargetTable): Record<string, string>[] {
  const schema = TABLE_SCHEMAS[tableName];
  const insertRegex = new RegExp(`INSERT\\s+INTO\\s+\`${tableName}\`\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]+)`, 'i');
  const match = sql.match(insertRegex);
  
  if (!match) return [];

  const columnsPart = match[1].trim();
  const valuesPart = match[2].trim();

  const columns = columnsPart.split(',').map(c => c.trim().replace(/[`"]/g, ''));
  console.log(`[DEBUG] Table ${tableName}: columns=${columns.length}, schema=${schema.columns.length}`);
  console.log(`[DEBUG] Columns:`, columns);
  
  if (columns.length !== schema.columns.length) {
    console.log(`[DEBUG] Column count mismatch for ${tableName}`);
    return [];
  }
  
  const valueGroups: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < valuesPart.length; i++) {
    const char = valuesPart[i];
    const nextChar = valuesPart[i + 1];

    if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      if (nextChar === quoteChar) {
        current += char + char;
        i++;
      } else if (char === '\\' && nextChar) {
        current += char + nextChar;
        i++;
      } else {
        inQuotes = false;
        current += char;
      }
    } else if (!inQuotes && char === '(') {
      // If we're at depth 0 and current has content (like comma separator), reset it
      if (parenDepth === 0 && current.trim().length > 0) {
        current = '';
      }
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      current += char;
      if (parenDepth === 0) {
        valueGroups.push(current.trim());
        current = '';
      }
    } else if (!inQuotes && char === ',' && parenDepth === 0) {
      // Skip comma separators between groups at depth 0
      continue;
    } else {
      current += char;
    }
  }

  console.log(`[DEBUG] Table ${tableName}: valueGroups count=${valueGroups.length}`);
  
  const rows: Record<string, string>[] = [];
  for (const group of valueGroups) {
    const inner = group.slice(1, -1).trim();
    const values = splitInsertValues(inner);
    
    console.log(`[DEBUG] Row values count: ${values.length}, expected: ${columns.length}`);
    console.log(`[DEBUG] Values:`, values.slice(0, 3));
    
    if (values.length !== columns.length) continue;

    const row: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = parseMySQLValue(values[i]);
    }
    rows.push(row);
  }

  return rows;
}

export function parseLegacySQLDump(sqlContent: string): ParsedLegacyData {
  const result: ParsedLegacyData = {
    register: [],
    officeregister: [],
    bill: [],
    users: [],
  };

  const statements = sqlContent.split(';').map(s => s.trim()).filter(s => s.length > 0);

  for (const statement of statements) {
    const upperStmt = statement.toUpperCase();
    
    if (!upperStmt.startsWith('INSERT INTO')) continue;

    for (const tableName of TARGET_TABLES) {
      const backtickTable = `\`${tableName}\``;
      if (upperStmt.includes(backtickTable.toUpperCase()) || upperStmt.includes(`"${tableName}"`) || upperStmt.includes(`${tableName} `)) {
        const rows = parseInsertStatement(statement, tableName);
        
        switch (tableName) {
          case 'register':
            result.register.push(...rows.map(mapToLegacyRegister));
            break;
          case 'officeregister':
            result.officeregister.push(...rows.map(mapToLegacyOfficeRegister));
            break;
          case 'bill':
            result.bill.push(...rows.map(mapToLegacyBill));
            break;
          case 'users':
            result.users.push(...rows.map(mapToLegacyUser));
            break;
        }
        break;
      }
    }
  }

  return result;
}

function mapToLegacyRegister(row: Record<string, string>): LegacyRegisterRow {
  return {
    id: parseInt(row.id || '0', 10),
    datebs: row.datebs || null,
    datead: row.datead || null,
    name: row.name || null,
    sex: row.sex || null,
    age: row.age || null,
    dob: row.dob || null,
    nationality: row.nationality || null,
    occupation: row.occupation || null,
    telephone: row.telephone || null,
    mobile: row.mobile || null,
    email: row.email || null,
    caddress: row.caddress || null,
    taddress: row.taddress || null,
  };
}

function mapToLegacyOfficeRegister(row: Record<string, string>): LegacyOfficeRegisterRow {
  return {
    id: parseInt(row.id || '0', 10),
    regno: row.regno || null,
    membershipno: row.membershipno || null,
    issuedate: row.issuedate || null,
    membershiptype: row.membershiptype || null,
    expdate: row.expdate || null,
    shift: row.shift || null,
    fitnessgoal: row.fitnessgoal || null,
    weight: row.weight || null,
    registeredby: row.registeredby || null,
    image: row.image || null,
    reg_id: row.reg_id ? parseInt(row.reg_id, 10) : null,
  };
}

function mapToLegacyBill(row: Record<string, string>): LegacyBillRow {
  return {
    bill_id: parseInt(row.bill_id || '0', 10),
    billno: row.billno || null,
    tobepaid: row.tobepaid || null,
    amount: row.amount || null,
    narration: row.narration || null,
    paiddate: row.paiddate || null,
    register_id: row.register_id ? parseInt(row.register_id, 10) : null,
  };
}

function mapToLegacyUser(row: Record<string, string>): LegacyUserRow {
  return {
    id: parseInt(row.id || '0', 10),
    username: row.username || null,
    password: row.password || null,
    name: row.name || null,
    time: row.time || null,
  };
}

export function validateParsedData(data: ParsedLegacyData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const row of data.register) {
    if (!row.id || row.id <= 0) {
      errors.push(`register: Invalid id ${row.id}`);
    }
    if (!row.name || row.name.trim().length < 2) {
      errors.push(`register id ${row.id}: Name too short or missing`);
    }
  }

  for (const row of data.officeregister) {
    if (!row.id || row.id <= 0) {
      errors.push(`officeregister: Invalid id ${row.id}`);
    }
  }

  for (const row of data.bill) {
    if (!row.bill_id || row.bill_id <= 0) {
      errors.push(`bill: Invalid bill_id ${row.bill_id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}