import { useEffect, useState } from "react";
import { phpGet } from "@src/Client/phpApi";
import { AdminCard, AdminNotice, AdminSectionTitle } from "@src/components/admin/AdminUI";

type Archive = { name: string; bytes: number; createdAt: string };
type BackupListing = { configured: boolean; archives: Archive[] };

const archiveDate = new Intl.DateTimeFormat("en-NP", {
  timeZone: "Asia/Kathmandu",
  dateStyle: "medium",
  timeStyle: "short",
});

export default function PhpBackupPanel() {
  const [listing, setListing] = useState<BackupListing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void phpGet<BackupListing>("/admin/backups").then((data) => {
      if (live) setListing(data);
    }).catch((issue: Error) => {
      if (live) setError(issue.message);
    });
    return () => { live = false; };
  }, []);

  return (
    <AdminCard>
      <AdminSectionTitle title="Backup and restore" description="Download encrypted archives created on the server. Restore through the server command into a separate empty database." />
      <div className="mt-4 space-y-2">
        {error ? <AdminNotice tone="warning">{error}</AdminNotice> : null}
        {!error && !listing ? <p role="status">Loading backups…</p> : null}
        {listing && !listing.configured ? <AdminNotice tone="warning">The backup directory is not configured.</AdminNotice> : null}
        {listing?.configured && !listing.archives.length ? <p className="text-sm text-slate-400">No backup archives are available.</p> : null}
        {listing?.archives.map((archive) => (
          <div key={archive.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="break-all text-slate-200">{archive.name}</div>
              <div className="text-slate-400">{archiveDate.format(new Date(archive.createdAt))} · {(archive.bytes / (1024 * 1024)).toFixed(2)} MiB</div>
            </div>
            <a className="font-semibold text-amber-300 underline" href={`/api/admin/backups/download?file=${encodeURIComponent(archive.name)}`}>
              Download archive
            </a>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
