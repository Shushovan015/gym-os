import NepaliDate from 'nepali-date-converter';

export interface ParsedDate {
  adDate: string | null;
  bsDate: string | null;
  originalValue: string;
  isValid: boolean;
  isNepaliDate: boolean;
  warnings: string[];
}

export interface NormalizedPhone {
  primary: string | null;
  secondary: string | null;
  originalValues: { telephone: string | null; mobile: string | null };
  warnings: string[];
}

export interface NormalizedMembershipType {
  type: string;
  originalValue: string;
  isValid: boolean;
  warnings: string[];
}

const VALID_MEMBERSHIP_TYPES = ['monthly', 'quarterly', 'yearly', 'trial'];

const PLACEHOLDER_VALUES = new Set([
  '000', '0000', '00000', '000000', '0000000',
  'nil', 'null', 'none', 'n/a', 'na', 'unknown', 'unk',
  '-', '--', '---', 'n.a.', 'not applicable',
]);

export function isPlaceholder(value: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  return PLACEHOLDER_VALUES.has(trimmed) || /^0+$/.test(trimmed);
}

function cleanString(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.length ? cleaned : null;
}

function parseAdDate(dateStr: string): string | null {
  const cleaned = dateStr.trim();
  if (!cleaned || isPlaceholder(cleaned)) return null;
  
  const match = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseNepaliDate(dateStr: string): { adDate: string | null; bsDate: string | null } {
  const cleaned = dateStr.trim();
  if (!cleaned || isPlaceholder(cleaned)) return { adDate: null, bsDate: null };
  
  const match = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return { adDate: null, bsDate: null };
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 32) {
    return { adDate: null, bsDate: null };
  }
  
  try {
    const bs = new NepaliDate(year, month - 1, day);
    const jsDate = bs.toJsDate();
    const adDate = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
    const bsDate = bs.format('YYYY-MM-DD');
    
    return { adDate, bsDate };
  } catch {
    return { adDate: null, bsDate: null };
  }
}

export function parseLegacyDate(datebs: string | null, datead: string | null): ParsedDate {
  const warnings: string[] = [];
  let adDate: string | null = null;
  let bsDate: string | null = null;
  let isValid = false;
  let isNepaliDate = false;
  
  const originalBs = datebs || '';
  const originalAd = datead || '';
  const originalValue = originalBs || originalAd;
  
  if (datebs && !isPlaceholder(datebs)) {
    const parsed = parseNepaliDate(datebs);
    if (parsed.adDate) {
      adDate = parsed.adDate;
      bsDate = parsed.bsDate;
      isNepaliDate = true;
      isValid = true;
    } else {
      warnings.push(`Invalid Nepali date format: ${datebs}`);
    }
  }
  
  if (!isValid && datead && !isPlaceholder(datead)) {
    adDate = parseAdDate(datead);
    if (adDate) {
      isValid = true;
      try {
        const [year, month, day] = adDate.split('-').map(Number);
        const jsDate = new Date(Date.UTC(year, month - 1, day));
        const bs = new NepaliDate(jsDate);
        bsDate = bs.format('YYYY-MM-DD');
      } catch {
        bsDate = null;
      }
    } else {
      warnings.push(`Invalid AD date format: ${datead}`);
    }
  }
  
  if (!isValid && originalValue) {
    warnings.push(`Could not parse date: ${originalValue}`);
  }
  
  return { adDate, bsDate, originalValue, isValid, isNepaliDate, warnings };
}

export function parseLegacyDob(dob: string | null): ParsedDate {
  return parseLegacyDate(null, dob);
}

export function normalizePhone(telephone: string | null, mobile: string | null): NormalizedPhone {
  const warnings: string[] = [];
  const originalValues = { telephone, mobile };
  
  const cleanPhone = (phone: string | null): string | null => {
    if (!phone) return null;
    const cleaned = phone.replace(/[^\d+\s-]/g, '').replace(/\s+/g, ' ').trim();
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Check if the original phone looks like a placeholder (all zeros with digits)
    // Only treat as placeholder if digitsOnly has content and is all zeros
    const isPlaceholderPhone = (digitsOnly.length > 0 && isPlaceholder(digitsOnly)) || isPlaceholder(phone.trim());
    
    if (!cleaned || isPlaceholderPhone) return null;
    
    if (!/^[\d+\s-]{7,}$/.test(cleaned)) {
      warnings.push(`Malformed phone number: ${phone}`);
      return phone.trim();
    }
    return cleaned;
  };
  
  const primary = cleanPhone(mobile) || cleanPhone(telephone);
  const secondary = primary === cleanPhone(mobile) ? cleanPhone(telephone) : cleanPhone(mobile);
  
  if (mobile && !cleanPhone(mobile)) {
    warnings.push(`Mobile number discarded as malformed: ${mobile}`);
  }
  if (telephone && !cleanPhone(telephone)) {
    warnings.push(`Telephone number discarded as malformed: ${telephone}`);
  }
  
  return { primary, secondary, originalValues, warnings };
}

export function normalizeEmail(email: string | null): { email: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const cleaned = cleanString(email);
  
  if (!cleaned) return { email: null, warnings };
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    warnings.push(`Invalid email format: ${cleaned}`);
    return { email: null, warnings };
  }
  
  return { email: cleaned.toLowerCase(), warnings };
}

export function normalizeGender(sex: string | null): { gender: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const cleaned = cleanString(sex);
  
  if (!cleaned) return { gender: null, warnings };
  
  const lower = cleaned.toLowerCase();
  if (lower === 'm' || lower === 'male') return { gender: 'male', warnings };
  if (lower === 'f' || lower === 'female') return { gender: 'female', warnings };
  
  warnings.push(`Unknown gender value: ${cleaned}`);
  return { gender: null, warnings };
}

export function normalizeAge(age: string | null): { age: number | null; warnings: string[] } {
  const warnings: string[] = [];
  const cleaned = cleanString(age);
  
  if (!cleaned) return { age: null, warnings };
  
  const parsed = parseInt(cleaned, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > 120) {
    warnings.push(`Invalid age value: ${cleaned}`);
    return { age: null, warnings };
  }
  
  return { age: parsed, warnings };
}

export function normalizeWeight(weight: string | null): { weight: number | null; warnings: string[] } {
  const warnings: string[] = [];
  const cleaned = cleanString(weight);
  
  if (!cleaned) return { weight: null, warnings };
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0 || parsed > 500) {
    warnings.push(`Invalid weight value: ${cleaned}`);
    return { weight: null, warnings };
  }
  
  return { weight: parsed, warnings };
}

export function normalizeMembershipType(membershiptype: string | null): NormalizedMembershipType {
  const warnings: string[] = [];
  const cleaned = cleanString(membershiptype);
  
  if (!cleaned) {
    return { type: 'monthly', originalValue: '', isValid: false, warnings: ['Missing membership type, defaulting to monthly'] };
  }
  
  const lower = cleaned.toLowerCase();
  const typeMap: Record<string, string> = {
    'monthly': 'monthly',
    'month': 'monthly',
    'quarterly': 'quarterly',
    'quarter': 'quarterly',
    '3month': 'quarterly',
    '3-month': 'quarterly',
    'yearly': 'yearly',
    'annual': 'yearly',
    'year': 'yearly',
    'trial': 'trial',
    'demo': 'trial',
  };
  
  const mapped = typeMap[lower];
  if (mapped && VALID_MEMBERSHIP_TYPES.includes(mapped)) {
    return { type: mapped, originalValue: cleaned, isValid: true, warnings };
  }
  
  warnings.push(`Unknown membership type: ${cleaned}, defaulting to monthly`);
  return { type: 'monthly', originalValue: cleaned, isValid: false, warnings };
}

export function normalizeMembershipStatus(expdate: string | null): { status: string; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!expdate || isPlaceholder(expdate)) {
    return { status: 'active', warnings };
  }
  
  const parsed = parseLegacyDate(null, expdate);
  if (!parsed.isValid || !parsed.adDate) {
    return { status: 'active', warnings: [...warnings, ...parsed.warnings] };
  }
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  if (parsed.adDate < todayStr) {
    return { status: 'expired', warnings };
  }
  
  return { status: 'active', warnings };
}

export function normalizePaymentStatus(tobepaid: string | null, amount: string | null): { status: string; warnings: string[] } {
  const warnings: string[] = [];
  const toBePaid = parseFloat(tobepaid || '0');
  const paid = parseFloat(amount || '0');
  
  if (isNaN(toBePaid) || isNaN(paid)) {
    return { status: 'unpaid', warnings: ['Invalid payment amounts'] };
  }
  
  if (paid >= toBePaid && toBePaid > 0) {
    return { status: 'paid', warnings };
  }
  
  if (paid > 0) {
    return { status: 'partial', warnings };
  }
  
  return { status: 'unpaid', warnings };
}

export function generateMemberId(legacyId: number): string {
  return `LEG-${String(legacyId).padStart(6, '0')}`;
}

export function buildAdditionalInfo(fields: Record<string, string | null>): string {
  const lines: string[] = ['Legacy Information'];
  
  const fieldLabels: Record<string, string> = {
    nationality: 'Nationality',
    occupation: 'Occupation',
    telephone: 'Telephone',
    taddress: 'Temporary Address',
    regno: 'Legacy Registration No',
    membershipno: 'Legacy Membership No',
    shift: 'Shift',
    fitnessgoal: 'Fitness Goal',
    weight: 'Weight (kg)',
    registeredby: 'Registered By',
    image: 'Legacy Image',
    billno: 'Legacy Bill No',
    narration: 'Payment Description',
    username: 'Legacy Username',
    legacy_dob: 'Legacy DOB',
    legacy_datebs: 'Legacy Date (BS)',
    legacy_datead: 'Legacy Date (AD)',
  };
  
  for (const [key, value] of Object.entries(fields)) {
    if (value && !isPlaceholder(value)) {
      const label = fieldLabels[key] || key;
      lines.push(`${label}: ${value}`);
    }
  }
  
  return lines.length > 1 ? lines.join('\n') : '';
}