import { useEffect, useRef, useState } from "react";
import { DatabaseBackup, Download, RefreshCw, Upload } from "lucide-react";
import { supabase } from "@src/Client/supabase";
import { backupApi } from "@src/config/backupApi";
import { AdminBadge, AdminButton, AdminCard, AdminInput, AdminNotice, AdminSectionTitle } from "@src/components/admin/AdminUI";

type Backup = { id: string; filename: string; size: number; createdAt: string; verified: boolean };
type Validation = { uploadId: string; filename: string; type: "full" | "legacy"; createdAt?: string; databaseIncluded: boolean; storageIncluded: boolean; verificationPassed: boolean };

async function token() { const { data } = await supabase.auth.getSession(); if (!data.session?.access_token) throw new Error("Please sign in again."); return data.session.access_token; }
async function fetchBackup(path: string, init: RequestInit = {}) {
  const accessToken = await token();
  let response: Response;
  try {
    response = await fetch(`${backupApi}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...init.headers } });
  } catch {
    throw new Error("Local backup service is unreachable. Start the gym app using the local launcher and check its terminal.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Local backup service did not respond. Check the local launcher and retry.");
  }
  return response;
}
async function request(path: string, init?: RequestInit) {
  const response = await fetchBackup(path, init);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The backup API returned an unexpected response. Start the app with the local launcher.");
  }
  return response.json();
}
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No backup yet"; }
function formatSize(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export default function BackupRestorePanel() {
  const picker = useRef<HTMLInputElement>(null); const [backups, setBackups] = useState<Backup[]>([]); const [last, setLast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Validation | null>(null); const [confirmation, setConfirmation] = useState(""); const [busy, setBusy] = useState<"backup" | "validate" | "restore" | "">(""); const [message, setMessage] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  const [connection, setConnection] = useState<{ ready: boolean; automatic?: boolean; detail?: string } | null>(null);
  const refresh = async () => {
    try {
      const status = await request("/api/backup/status");
      setLast(status.lastSuccessfulBackup);
      setConnection({ ready: status.dependencies.ready, detail: status.dependencies.error, automatic: status.automaticBackupsEnabled });
      if (status.dependencies.destinationReady) setBackups((await request("/api/backup/list")).backups);
    } catch (error) {
      setConnection({ ready: false, detail: error instanceof Error ? error.message : "Local backup service is unavailable." });
    }
  };
  useEffect(() => { if (backupApi !== null) void refresh(); }, []);
  const create = async () => { setBusy("backup"); setMessage(null); try { const result = await request("/api/backup/create", { method: "POST" }); setMessage({ tone: result.secondary?.configured && !result.secondary?.copied ? "warning" : "success", text: result.secondary?.configured && !result.secondary?.copied ? "Backup completed locally, but the off-PC copy failed." : "Backup completed and verified successfully." }); await refresh(); } catch (error) { setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Backup failed." }); } finally { setBusy(""); } };
  const choose = async (file?: File) => { if (!file) return; setBusy("validate"); setSelected(null); setConfirmation(""); setMessage(null); try { const result = await request("/api/backup/validate", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Backup-Filename": encodeURIComponent(file.name) }, body: file }); setSelected(result); setMessage({ tone: result.type === "legacy" ? "warning" : "success", text: result.type === "legacy" ? "Valid PostgreSQL database dump. Uploaded Storage files are not included." : "Backup package is valid and ready to restore." }); } catch (error) { setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Backup validation failed." }); } finally { setBusy(""); if (picker.current) picker.current.value = ""; } };
  const restore = async () => { if (!selected || confirmation !== "RESTORE") return; setBusy("restore"); setMessage({ tone: "warning", text: "Restoring backup. Do not close the application or computer." }); try { const result = await request("/api/backup/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId: selected.uploadId, confirmation }) }); setMessage({ tone: "success", text: `Restore completed successfully. Safety backup: ${result.safetyBackup}` }); setSelected(null); setConfirmation(""); await refresh(); } catch (error) { setMessage({ tone: "danger", text: `${error instanceof Error ? error.message : "Restore failed."} A pre-restore safety backup is preserved when creation succeeded.` }); } finally { setBusy(""); } };
  const download = async (item: Backup) => { try { const response = await fetchBackup(`/api/backup/download/${encodeURIComponent(item.id)}`); const href = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = href; link.download = item.filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(href), 1000); } catch (error) { setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Download failed." }); } };
  const disabled = Boolean(busy);
  if (backupApi === null) return <AdminCard>
    <AdminSectionTitle title="Backup & Restore" description="This installation uses hosted Supabase. Use your Supabase project backup tools and export Storage files separately." />
  </AdminCard>;
  return <AdminCard>
    <AdminSectionTitle title="Backup & Restore" description="Protect the gym database and uploaded files with verified local backup packages." />
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <AdminBadge tone={connection?.ready ? "success" : "neutral"}>{connection ? (connection.ready ? "Backup service connected" : "Backup service unavailable") : "Checking backup service..."}</AdminBadge>
      <AdminButton type="button" variant="secondary" onClick={refresh} disabled={disabled}>Check connection</AdminButton>
    </div>
    {connection?.detail ? <div className="mt-3"><AdminNotice tone="warning">{connection.detail}</AdminNotice></div> : null}
    {message ? <div className="mt-4" role="status"><AdminNotice tone={message.tone}>{message.text}</AdminNotice></div> : null}
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Last successful backup</div><div className="mt-2 font-semibold text-white">{formatDate(last)}</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Automatic backups</div><div className="mt-2"><AdminBadge tone={connection?.ready && connection.automatic ? "success" : "neutral"}>{connection?.ready && connection.automatic ? "On while Gym is running" : "Unavailable"}</AdminBadge></div></div>
      <div className="flex items-center"><AdminButton type="button" variant="primary" onClick={create} disabled={disabled || !connection?.ready}><DatabaseBackup className="h-4 w-4" />{busy === "backup" ? "Creating backup..." : "Create Backup"}</AdminButton></div>
    </div>
    <div className="mt-7 border-t border-slate-800 pt-6"><h3 className="font-bold text-white">Recent backups</h3><div className="mt-3 space-y-2">{backups.length ? backups.slice(0, 10).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm"><div><div className="font-medium text-white">{item.filename}</div><div className="text-slate-500">{formatDate(item.createdAt)} | {formatSize(item.size)} | Verified</div></div><AdminButton type="button" variant="secondary" onClick={() => download(item)} disabled={disabled}><Download className="h-4 w-4" />Download</AdminButton></div>) : <div className="text-sm text-slate-500">No full backup packages yet.</div>}</div></div>
    <div className="mt-7 border-t border-slate-800 pt-6"><h3 className="font-bold text-white">Restore Backup</h3><p className="mt-1 text-sm text-slate-400">A full safety backup is always created before current data is replaced.</p><input ref={picker} type="file" accept=".zip,.dump" aria-label="Backup file" className="hidden" onChange={(event) => choose(event.target.files?.[0])} /><AdminButton type="button" variant="secondary" className="mt-4" onClick={() => picker.current?.click()} disabled={disabled || !connection?.ready}><Upload className="h-4 w-4" />{busy === "validate" ? "Checking backup..." : "Choose Backup File"}</AdminButton>
      {selected ? <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4"><div className="font-semibold text-white">{selected.filename}</div><div className="mt-2 grid gap-1 text-sm text-slate-300"><span>Database: Included</span><span>Storage: {selected.storageIncluded ? "Included" : "Not included"}</span><span>Verification: Passed</span></div><label className="mt-4 block text-sm font-semibold text-white">Type RESTORE to continue</label><AdminInput aria-label="Type RESTORE to continue" className="mt-2 max-w-xs" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /><AdminButton type="button" variant="primary" className="mt-3" onClick={restore} disabled={disabled || !connection?.ready || confirmation !== "RESTORE"}><RefreshCw className="h-4 w-4" />{busy === "restore" ? "Restoring..." : "Restore Backup"}</AdminButton></div> : null}
    </div>
  </AdminCard>;
}
