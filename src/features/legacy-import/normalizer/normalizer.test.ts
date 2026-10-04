import {
  parseLegacyDate,
  parseLegacyDob,
  normalizePhone,
  normalizeEmail,
  normalizeGender,
  normalizeAge,
  normalizeWeight,
  normalizeMembershipType,
  normalizeMembershipStatus,
  normalizePaymentStatus,
  generateMemberId,
  buildAdditionalInfo,
  isPlaceholder,
} from '../normalizer';

describe('Date Normalization', () => {
  test('parses valid AD date', () => {
    const result = parseLegacyDate(null, '2021-08-25');
    expect(result.isValid).toBe(true);
    expect(result.adDate).toBe('2021-08-25');
    expect(result.isNepaliDate).toBe(false);
  });

  test('parses valid Nepali date', () => {
    const result = parseLegacyDate('2078-05-10', null);
    expect(result.isValid).toBe(true);
    expect(result.adDate).toBeDefined();
    expect(result.bsDate).toBe('2078-05-10');
    expect(result.isNepaliDate).toBe(true);
  });

  test('prefers Nepali date when both provided', () => {
    const result = parseLegacyDate('2078-05-10', '2021-08-25');
    expect(result.isValid).toBe(true);
    expect(result.isNepaliDate).toBe(true);
  });

  test('handles placeholder values as invalid', () => {
    const result = parseLegacyDate('00000', '0000-00-00');
    expect(result.isValid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('handles empty values', () => {
    const result = parseLegacyDate(null, null);
    expect(result.isValid).toBe(false);
    expect(result.adDate).toBeNull();
  });

  test('rejects invalid date formats', () => {
    const result = parseLegacyDate('not-a-date', 'also-invalid');
    expect(result.isValid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('rejects out of range dates', () => {
    const result = parseLegacyDate(null, '2099-13-45');
    expect(result.isValid).toBe(false);
  });

  test('parses DOB correctly', () => {
    const result = parseLegacyDob('1991-03-15');
    expect(result.isValid).toBe(true);
    expect(result.adDate).toBe('1991-03-15');
  });

  test('handles placeholder DOB', () => {
    const result = parseLegacyDob('00000');
    expect(result.isValid).toBe(false);
    expect(result.originalValue).toBe('00000');
  });
});

describe('Phone Normalization', () => {
  test('prefers mobile over telephone', () => {
    const result = normalizePhone('01-456789', '9841234567');
    expect(result.primary).toBe('9841234567');
    expect(result.secondary).toBe('01-456789');
  });

  test('uses telephone when mobile is empty', () => {
    const result = normalizePhone('01-456789', null);
    expect(result.primary).toBe('01-456789');
    expect(result.secondary).toBeNull();
  });

  test('handles both empty', () => {
    const result = normalizePhone(null, null);
    expect(result.primary).toBeNull();
    expect(result.secondary).toBeNull();
  });

  test('cleans special characters', () => {
    const result = normalizePhone('+977-1-456-789', '(984) 123-4567');
    expect(result.primary).toBe('984 123-4567');
    expect(result.secondary).toBe('+977-1-456-789');
  });

  test('warns on malformed numbers', () => {
    const result = normalizePhone('abc123', 'def456');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.primary).toBe('def456'); // mobile preferred over telephone
  });

  test('detects placeholder phone numbers', () => {
    const result = normalizePhone('000000', '000-0000');
    expect(result.primary).toBeNull();
  });
});

describe('Email Normalization', () => {
  test('normalizes valid email', () => {
    const result = normalizeEmail('Test@Example.COM');
    expect(result.email).toBe('test@example.com');
    expect(result.warnings).toHaveLength(0);
  });

  test('rejects invalid email', () => {
    const result = normalizeEmail('not-an-email');
    expect(result.email).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('handles empty email', () => {
    const result = normalizeEmail('');
    expect(result.email).toBeNull();
  });
});

describe('Gender Normalization', () => {
  test('normalizes male variations', () => {
    expect(normalizeGender('M').gender).toBe('male');
    expect(normalizeGender('m').gender).toBe('male');
    expect(normalizeGender('Male').gender).toBe('male');
    expect(normalizeGender('male').gender).toBe('male');
  });

  test('normalizes female variations', () => {
    expect(normalizeGender('F').gender).toBe('female');
    expect(normalizeGender('f').gender).toBe('female');
    expect(normalizeGender('Female').gender).toBe('female');
    expect(normalizeGender('female').gender).toBe('female');
  });

  test('warns on unknown gender', () => {
    const result = normalizeGender('Other');
    expect(result.gender).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Age Normalization', () => {
  test('parses valid age', () => {
    const result = normalizeAge('30');
    expect(result.age).toBe(30);
  });

  test('rejects invalid age', () => {
    const result = normalizeAge('abc');
    expect(result.age).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('rejects out of range age', () => {
    const result = normalizeAge('150');
    expect(result.age).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Weight Normalization', () => {
  test('parses valid weight', () => {
    const result = normalizeWeight('75.5');
    expect(result.weight).toBe(75.5);
  });

  test('rejects invalid weight', () => {
    const result = normalizeWeight('abc');
    expect(result.weight).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Membership Type Normalization', () => {
  test('normalizes monthly variations', () => {
    expect(normalizeMembershipType('monthly').type).toBe('monthly');
    expect(normalizeMembershipType('month').type).toBe('monthly');
    expect(normalizeMembershipType('Monthly').type).toBe('monthly');
  });

  test('normalizes quarterly variations', () => {
    expect(normalizeMembershipType('quarterly').type).toBe('quarterly');
    expect(normalizeMembershipType('quarter').type).toBe('quarterly');
    expect(normalizeMembershipType('3month').type).toBe('quarterly');
  });

  test('normalizes yearly variations', () => {
    expect(normalizeMembershipType('yearly').type).toBe('yearly');
    expect(normalizeMembershipType('annual').type).toBe('yearly');
    expect(normalizeMembershipType('year').type).toBe('yearly');
  });

  test('normalizes trial', () => {
    expect(normalizeMembershipType('trial').type).toBe('trial');
    expect(normalizeMembershipType('demo').type).toBe('trial');
  });

  test('defaults to monthly for unknown', () => {
    const result = normalizeMembershipType('unknown');
    expect(result.type).toBe('monthly');
    expect(result.isValid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('defaults to monthly for empty', () => {
    const result = normalizeMembershipType(null);
    expect(result.type).toBe('monthly');
    expect(result.isValid).toBe(false);
  });
});

describe('Membership Status Normalization', () => {
  test('returns expired for past dates', () => {
    const pastDate = '2020-01-01';
    const result = normalizeMembershipStatus(pastDate, '2019-01-01');
    expect(result.status).toBe('expired');
  });

  test('returns active for future dates', () => {
    const futureDate = '2030-01-01';
    const result = normalizeMembershipStatus(futureDate, '2025-01-01');
    expect(result.status).toBe('active');
  });

  test('returns active for missing expdate', () => {
    const result = normalizeMembershipStatus(null, '2025-01-01');
    expect(result.status).toBe('active');
  });
});

describe('Payment Status Normalization', () => {
  test('returns paid when fully paid', () => {
    const result = normalizePaymentStatus('5000', '5000');
    expect(result.status).toBe('paid');
  });

  test('returns partial when partially paid', () => {
    const result = normalizePaymentStatus('5000', '2500');
    expect(result.status).toBe('partial');
  });

  test('returns unpaid when nothing paid', () => {
    const result = normalizePaymentStatus('5000', '0');
    expect(result.status).toBe('unpaid');
  });

  test('handles invalid amounts', () => {
    const result = normalizePaymentStatus('abc', 'def');
    expect(result.status).toBe('unpaid');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Member ID Generation', () => {
  test('generates consistent IDs', () => {
    expect(generateMemberId(1)).toBe('LEG-000001');
    expect(generateMemberId(123)).toBe('LEG-000123');
    expect(generateMemberId(999999)).toBe('LEG-999999');
  });
});

describe('Additional Info Building', () => {
  test('builds formatted additional info', () => {
    const fields = {
      nationality: 'Nepali',
      occupation: 'Business',
      telephone: '01-456789',
      taddress: 'Bhaktapur',
    };
    const result = buildAdditionalInfo(fields);
    expect(result).toContain('Legacy Information');
    expect(result).toContain('Nationality: Nepali');
    expect(result).toContain('Occupation: Business');
    expect(result).toContain('Telephone: 01-456789');
    expect(result).toContain('Temporary Address: Bhaktapur');
  });

  test('excludes placeholder values', () => {
    const fields = {
      nationality: '000',
      occupation: 'N/A',
      telephone: '',
      taddress: null,
    };
    const result = buildAdditionalInfo(fields);
    expect(result).toBe('');
  });

  test('handles empty object', () => {
    const result = buildAdditionalInfo({});
    expect(result).toBe('');
  });
});

describe('Placeholder Detection', () => {
  test('detects common placeholders', () => {
    expect(isPlaceholder('000')).toBe(true);
    expect(isPlaceholder('00000')).toBe(true);
    expect(isPlaceholder('nil')).toBe(true);
    expect(isPlaceholder('null')).toBe(true);
    expect(isPlaceholder('none')).toBe(true);
    expect(isPlaceholder('n/a')).toBe(true);
    expect(isPlaceholder('N/A')).toBe(true);
    expect(isPlaceholder('unknown')).toBe(true);
    expect(isPlaceholder('-')).toBe(true);
    expect(isPlaceholder('--')).toBe(true);
  });

  test('does not detect real values', () => {
    expect(isPlaceholder('Nepali')).toBe(false);
    expect(isPlaceholder('Business')).toBe(false);
    expect(isPlaceholder('9841234567')).toBe(false);
    expect(isPlaceholder('2021-08-25')).toBe(false);
    expect(isPlaceholder('0')).toBe(true); // all zeros treated as placeholder
  });
});