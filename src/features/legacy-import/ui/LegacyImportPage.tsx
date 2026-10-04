import { useState, useCallback } from 'react';
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminPageHeader,
  AdminField,
  AdminInput,
  AdminNotice,
} from '@src/components/admin/AdminUI';
import { cx } from '@src/pages/admin/adminUtils';
import type { ImportPreview, FieldCompletenessReport } from '../types';
import { previewLegacyImport } from '../migrationService';
import { runLegacyImport } from '../migrationService';
import { formatImportPreview, formatCompletenessReport, formatMigrationResult } from '../preview';
import { Upload, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const isValidUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const STEP_UPLOAD = 1;
const STEP_PREVIEW = 2;
const STEP_COMPLETENESS = 3;
const STEP_CONFIRM = 4;
const STEP_EXECUTE = 5;
const STEP_RESULT = 6;

export function LegacyImportPage() {
  const [step, setStep] = useState(STEP_UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [sqlContent, setSqlContent] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [completenessReport, setCompletenessReport] = useState<FieldCompletenessReport[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runLegacyImport>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string>('');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.sql')) {
      setError('Please select a .sql file');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSqlContent(content);
    };
    reader.readAsText(selectedFile);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!sqlContent.trim()) {
      setError('No SQL content to preview');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { preview: previewData, completenessReport: report } = await previewLegacyImport(sqlContent);
      setPreview(previewData);
      setCompletenessReport(report);
      setStep(STEP_PREVIEW);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview import');
    } finally {
      setLoading(false);
    }
  }, [sqlContent]);

  const handleConfirm = useCallback(() => {
    setStep(STEP_CONFIRM);
  }, []);

  const handleExecute = useCallback(async () => {
    if (!file || !isValidUUID(adminUserId)) {
      setError('Missing file or invalid admin user ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    setStep(STEP_EXECUTE);
    
    try {
      const migrationResult = await runLegacyImport({
        fileName: file.name,
        sqlContent,
        adminUserId,
      });
      setResult(migrationResult);
      setStep(STEP_RESULT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
      setStep(STEP_CONFIRM);
    } finally {
      setLoading(false);
    }
  }, [file, sqlContent, adminUserId]);

  const handleRetry = useCallback(() => {
    setStep(STEP_UPLOAD);
    setFile(null);
    setSqlContent('');
    setPreview(null);
    setCompletenessReport([]);
    setResult(null);
    setError(null);
  }, []);

  const renderUploadStep = () => (
    <AdminCard className="max-w-2xl mx-auto">
      <AdminPageHeader
        title="Import Legacy Gym Data"
        description="Upload a MySQL/MariaDB SQL dump containing legacy gym data from the old system."
      />
      
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2 text-sm">
          <AdminBadge tone="accent">register</AdminBadge>
          <AdminBadge tone="neutral">→ Members</AdminBadge>
          <AdminBadge tone="accent">officeregister</AdminBadge>
          <AdminBadge tone="neutral">→ Membership Fees</AdminBadge>
          <AdminBadge tone="accent">bill</AdminBadge>
          <AdminBadge tone="neutral">→ Invoices & Payments</AdminBadge>
          <AdminBadge tone="muted">users</AdminBadge>
          <AdminBadge tone="neutral">→ NOT imported</AdminBadge>
        </div>
        
        <div className={cx(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          file ? "border-amber-500/50 bg-amber-500/5" : "border-slate-700 hover:border-slate-600"
        )}>
          <input
            type="file"
            accept=".sql"
            onChange={handleFileChange}
            className="sr-only"
            id="legacy-sql-file"
            disabled={loading}
          />
          <label htmlFor="legacy-sql-file" className="cursor-pointer flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-slate-500" />
            <div>
              <p className="text-lg font-medium text-white">Click to select or drag and drop</p>
              <p className="text-sm text-slate-500">.sql files only</p>
            </div>
          </label>
        </div>
        
        {file && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-300">
            <p className="font-medium">Selected: {file.name}</p>
            <p className="text-sm text-green-500">Size: {(file.size / 1024).toFixed(1)} KB</p>
          </div>
        )}
        
        {error && (
          <AdminNotice tone="danger" title="Error">{error}</AdminNotice>
        )}
        
        <AdminButton
          onClick={handlePreview}
          disabled={!file || loading}
          className="w-full"
          variant="primary"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing...
            </>
          ) : (
            'Preview Import'
          )}
        </AdminButton>
      </div>
    </AdminCard>
  );

  const renderPreviewStep = () => (
    <AdminCard className="max-w-4xl mx-auto">
      <AdminPageHeader
        title="Import Preview"
        actions={
          <div className="flex gap-2">
            <AdminButton variant="ghost" onClick={() => setStep(STEP_UPLOAD)}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </AdminButton>
            <AdminButton onClick={() => setStep(STEP_COMPLETENESS)}>
              Next <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        }
      />
      
      <AdminCard className="bg-slate-950">
        <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono p-4">
          {formatImportPreview(preview!)}
        </pre>
      </AdminCard>
    </AdminCard>
  );

  const renderCompletenessStep = () => (
    <AdminCard className="max-w-4xl mx-auto">
      <AdminPageHeader
        title="Field Completeness Report"
        actions={
          <div className="flex gap-2">
            <AdminButton variant="ghost" onClick={() => setStep(STEP_PREVIEW)}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </AdminButton>
            <AdminButton onClick={handleConfirm}>
              Next <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        }
      />
      
      <AdminCard className="bg-slate-950">
        <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono p-4">
          {formatCompletenessReport(completenessReport)}
        </pre>
      </AdminCard>
    </AdminCard>
  );

  const renderConfirmStep = () => (
    <AdminCard className="max-w-2xl mx-auto">
      <AdminPageHeader title="Confirm Import" />
      
      <AdminNotice tone="warning" title="⚠ Please review before proceeding">
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>This will create <strong>{preview?.summary.members}</strong> member records</li>
          <li>This will create <strong>{preview?.summary.membershipRecords}</strong> membership fee records</li>
          <li>This will create <strong>{preview?.summary.billingRecords}</strong> invoice/payment records</li>
          <li><strong>{preview?.warnings.length}</strong> warnings will be logged</li>
          <li><strong>{preview?.invalidRecords.length}</strong> invalid records will be skipped</li>
          <li><strong>{preview?.duplicateCandidates.length}</strong> potential duplicates detected</li>
          <li>Legacy <strong>users</strong> table will NOT be imported</li>
        </ul>
      </AdminNotice>
      
      <AdminField label="Admin User ID (for audit trail)">
        <AdminInput
          value={adminUserId}
          onChange={(e) => setAdminUserId(e.target.value)}
          placeholder="Enter your admin user UUID (from Supabase Auth → Users)"
          className={adminUserId && !isValidUUID(adminUserId) ? 'border-red-500 bg-red-500/10' : ''}
        />
        {!adminUserId ? (
          <p className="text-red-500 text-sm mt-1">Required</p>
        ) : !isValidUUID(adminUserId) ? (
          <p className="text-red-500 text-sm mt-1">Must be a valid UUID (e.g. 123e4567-e89b-12d3-a456-426614174000)</p>
        ) : (
          <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Valid UUID format
          </p>
        )}
      </AdminField>
      
      <div className="flex gap-4 pt-4">
        <AdminButton variant="secondary" onClick={() => setStep(STEP_COMPLETENESS)}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </AdminButton>
        <AdminButton
          variant="danger"
          onClick={handleExecute}
          disabled={!adminUserId || !isValidUUID(adminUserId) || loading}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            'Execute Import'
          )}
        </AdminButton>
      </div>
    </AdminCard>
  );

  const renderExecuteStep = () => (
    <AdminCard className="max-w-2xl mx-auto text-center py-12">
      <Loader2 className="mx-auto h-16 w-16 animate-spin text-amber-400" />
      <h2 className="mt-4 text-xl font-semibold text-white">Importing Legacy Data...</h2>
      <p className="mt-2 text-slate-400">Please do not close this window. This may take a few minutes.</p>
    </AdminCard>
  );

  const renderResultStep = () => (
    <AdminCard className="max-w-4xl mx-auto">
      <AdminPageHeader
        title={result?.success ? 'Import Completed Successfully' : 'Import Completed with Errors'}
        description={result?.success 
          ? 'All legacy data has been migrated successfully'
          : 'Some errors occurred during migration'}
      />
      
      {result?.errors && result.errors.length > 0 && (
        <div className="mb-6">
          <AdminNotice tone="danger" title="Errors">
            <ul className="list-disc list-inside space-y-1">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </AdminNotice>
        </div>
      )}
      
      <AdminCard className="bg-slate-950">
        <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono p-4">
          {formatMigrationResult(result!)}
        </pre>
      </AdminCard>
      
      <div className="flex justify-center pt-4">
        <AdminButton variant="primary" onClick={handleRetry}>
          Import Another File
        </AdminButton>
      </div>
    </AdminCard>
  );

  const renderStep = () => {
    switch (step) {
      case STEP_UPLOAD:
        return renderUploadStep();
      case STEP_PREVIEW:
        return renderPreviewStep();
      case STEP_COMPLETENESS:
        return renderCompletenessStep();
      case STEP_CONFIRM:
        return renderConfirmStep();
      case STEP_EXECUTE:
        return renderExecuteStep();
      case STEP_RESULT:
        return renderResultStep();
      default:
        return renderUploadStep();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {renderStep()}
      </div>
    </div>
  );
}