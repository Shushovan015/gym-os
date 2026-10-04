import type { ImportPreview, FieldCompletenessReport, MigrationResult, ImportLogEntry } from '../types';

export function formatImportPreview(preview: ImportPreview): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════');
  lines.push('       LEGACY GYM DATA IMPORT PREVIEW');
  lines.push('═══════════════════════════════════════════');
  lines.push('');
  lines.push('LEGACY DATA FOUND:');
  lines.push(`  Members:              ${preview.summary.members.toLocaleString()}`);
  lines.push(`  Membership Records:  ${preview.summary.membershipRecords.toLocaleString()}`);
  lines.push(`  Billing Records:     ${preview.summary.billingRecords.toLocaleString()}`);
  lines.push(`  Legacy Users:        ${preview.summary.legacyUsers.toLocaleString()} (NOT imported)`);
  lines.push('');
  
  if (preview.warnings.length > 0) {
    lines.push('⚠ WARNINGS:');
    const warningsByType = groupBy(preview.warnings, w => w.type);
    for (const [type, warnings] of Object.entries(warningsByType)) {
      lines.push(`  ${type}: ${warnings.reduce((sum, w) => sum + w.count, 0)} occurrences`);
      for (const w of warnings) {
        for (const detail of w.details.slice(0, 3)) {
          lines.push(`    - ${detail}`);
        }
        if (w.details.length > 3) {
          lines.push(`    ... and ${w.details.length - 3} more`);
        }
      }
    }
    lines.push('');
  }
  
  if (preview.invalidRecords.length > 0) {
    lines.push('✗ INVALID RECORDS (will be skipped):');
    for (const r of preview.invalidRecords.slice(0, 10)) {
      lines.push(`  ${r.table}#${r.legacyId} [${r.field}]: ${r.reason} (value: "${r.value.slice(0, 50)}")`);
    }
    if (preview.invalidRecords.length > 10) {
      lines.push(`  ... and ${preview.invalidRecords.length - 10} more`);
    }
    lines.push('');
  }
  
  if (preview.missingReferences.length > 0) {
    lines.push('⚠ MISSING REFERENCES:');
    for (const r of preview.missingReferences.slice(0, 10)) {
      lines.push(`  ${r.table}#${r.legacyId} -> ${r.referencedTable}#${r.referencedId}`);
    }
    if (preview.missingReferences.length > 10) {
      lines.push(`  ... and ${preview.missingReferences.length - 10} more`);
    }
    lines.push('');
  }
  
  if (preview.duplicateCandidates.length > 0) {
    lines.push('⚠ DUPLICATE CANDIDATES (require review):');
    for (const d of preview.duplicateCandidates.slice(0, 10)) {
      lines.push(`  Legacy ${d.type}#${d.legacyId} ~ Existing #${d.existingId} (${d.matchReason})`);
    }
    if (preview.duplicateCandidates.length > 10) {
      lines.push(`  ... and ${preview.duplicateCandidates.length - 10} more`);
    }
    lines.push('');
  }
  
  lines.push(`FIELDS REQUIRING ADDITIONAL INFORMATION: ${preview.fieldsRequiringNotes}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════');
  lines.push('Ready to import? Review the above carefully.');
  lines.push('═══════════════════════════════════════════');
  
  return lines.join('\n');
}

function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function formatCompletenessReport(report: FieldCompletenessReport[]): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('           FIELD COMPLETENESS REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Field                  Table           Total   Migrated  Notes   Empty');
  lines.push('────────────────────────────────────────────────────────────────────');
  
  for (const row of report) {
    const field = row.field.padEnd(22);
    const table = row.table.padEnd(15);
    const total = String(row.total).padStart(6);
    const migrated = String(row.migrated).padStart(9);
    const notes = String(row.preservedInNotes).padStart(7);
    const empty = String(row.empty).padStart(6);
    lines.push(`${field} ${table} ${total} ${migrated} ${notes} ${empty}`);
  }
  
  lines.push('────────────────────────────────────────────────────────────────────');
  
  const totalAll = report.reduce((sum, r) => sum + r.total, 0);
  const migratedAll = report.reduce((sum, r) => sum + r.migrated, 0);
  const notesAll = report.reduce((sum, r) => sum + r.preservedInNotes, 0);
  const emptyAll = report.reduce((sum, r) => sum + r.empty, 0);
  
  lines.push(`${'TOTAL'.padEnd(22)} ${''.padEnd(15)} ${String(totalAll).padStart(6)} ${String(migratedAll).padStart(9)} ${String(notesAll).padStart(7)} ${String(emptyAll).padStart(6)}`);
  lines.push('');
  lines.push(`COMPLETENESS: ${((migratedAll + notesAll) / (totalAll - emptyAll) * 100).toFixed(1)}% (${migratedAll + notesAll}/${totalAll - emptyAll} meaningful values preserved)`);
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

export function formatMigrationResult(result: MigrationResult): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════');
  lines.push('       MIGRATION COMPLETED');
  lines.push('═══════════════════════════════════════════');
  lines.push('');
  lines.push(`Members imported:      ${result.membersImported.toLocaleString()}`);
  lines.push(`Memberships imported:  ${result.membershipsImported.toLocaleString()}`);
  lines.push(`Payments imported:     ${result.paymentsImported.toLocaleString()}`);
  lines.push('');
  
  if (result.warnings.length > 0) {
    lines.push(`Warnings:              ${result.warnings.length}`);
    for (const w of result.warnings.slice(0, 5)) {
      lines.push(`  - ${w.type}: ${w.count}`);
    }
  }
  
  if (result.errors.length > 0) {
    lines.push(`Errors:                ${result.errors.length}`);
    for (const e of result.errors.slice(0, 5)) {
      lines.push(`  - ${e}`);
    }
  }
  
  lines.push(`Skipped records:       ${result.skippedRecords}`);
  lines.push(`Preserved in notes:    ${result.preservedInNotesCount} fields`);
  lines.push('');
  
  if (result.errors.length === 0) {
    lines.push('✓ No meaningful legacy data was silently discarded.');
  } else {
    lines.push('✗ Migration completed with errors. Review above.');
  }
  
  lines.push('═══════════════════════════════════════════');
  
  return lines.join('\n');
}

export function formatImportLog(log: ImportLogEntry): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════');
  lines.push('       IMPORT LOG ENTRY');
  lines.push('═══════════════════════════════════════════');
  lines.push(`File:           ${log.fileName}`);
  lines.push(`Date:           ${log.importDate}`);
  lines.push(`Status:         ${log.status.toUpperCase()}`);
  lines.push('');
  lines.push(`Members found:      ${log.membersFound}`);
  lines.push(`Members imported:   ${log.membersImported}`);
  lines.push(`Memberships imported: ${log.membershipsImported}`);
  lines.push(`Bills imported:     ${log.billsImported}`);
  lines.push('');
  lines.push(`Warnings:           ${log.warnings}`);
  lines.push(`Errors:             ${log.errors}`);
  lines.push(`Skipped:            ${log.skippedRecords}`);
  lines.push(`Preserved in notes: ${log.preservedInNotes}`);
  
  if (log.errorDetails) {
    lines.push('');
    lines.push(`Error details: ${log.errorDetails}`);
  }
  
  lines.push('═══════════════════════════════════════════');
  
  return lines.join('\n');
}