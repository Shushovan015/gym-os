import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BackupRestorePanel from "./BackupRestorePanel";

vi.mock("@src/config/backupApi", () => ({ backupApi: "" }));
vi.mock("@src/Client/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } },
}));

const backup = { id: "gym-backup-fixture.zip", filename: "gym-backup-fixture.zip", size: 2048, createdAt: "2026-11-22T08:00:00Z" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("creates and downloads a verified ZIP via the local same-origin API", async () => {
  const blobUrl = vi.fn(() => "blob:test");
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: blobUrl, revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  let created = false;
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith("/status")) return Response.json({ dependencies: { ready: true, destinationReady: true }, automaticBackupsEnabled: true });
    if (url.endsWith("/list")) return Response.json({ backups: created ? [backup] : [] });
    if (url.endsWith("/create")) { created = true; return Response.json({}); }
    return new Response("fake zip", { headers: { "Content-Type": "application/zip" } });
  });
  vi.stubGlobal("fetch", fetch);
  render(<BackupRestorePanel />);
  await screen.findByText("Backup service connected");
  fireEvent.click(screen.getByRole("button", { name: "Create Backup" }));
  await screen.findByText("Backup completed and verified successfully.");
  fireEvent.click(await screen.findByRole("button", { name: "Download" }));
  await waitFor(() => expect(blobUrl).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith("/api/backup/create", expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer test-token" } }));
  expect(fetch).toHaveBeenCalledWith(`/api/backup/download/${backup.id}`, expect.any(Object));
});

it("validates a backup and enables restore only after explicit confirmation", async () => {
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith("/status")) return Response.json({ dependencies: { ready: true, destinationReady: true } });
    if (url.endsWith("/list")) return Response.json({ backups: [] });
    if (url.endsWith("/validate")) return Response.json({ ...backup, uploadId: "validated-fixture", type: "full", storageIncluded: true });
    return Response.json({ safetyBackup: "pre-restore-fixture.zip" });
  });
  vi.stubGlobal("fetch", fetch);
  const { container } = render(<BackupRestorePanel />);
  await screen.findByText("Backup service connected");
  const zip = new File(["fixture"], backup.filename, { type: "application/zip" });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [zip] } });
  const restore = await screen.findByRole("button", { name: "Restore Backup" });
  expect(restore).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "RESTORE" } });
  fireEvent.click(restore);
  await screen.findByText(/Restore completed successfully.*pre-restore-fixture/);
  expect(fetch).toHaveBeenCalledWith("/api/backup/validate", expect.objectContaining({ body: zip }));
  expect(fetch).toHaveBeenCalledWith("/api/backup/restore", expect.objectContaining({
    body: JSON.stringify({ uploadId: "validated-fixture", confirmation: "RESTORE" }),
  }));
});

it("reports service failures and offers a connection retry", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Docker permission denied." }, { status: 503 })));
  render(<BackupRestorePanel />);
  await screen.findByText("Docker permission denied.");
  expect(screen.getByRole("button", { name: "Create Backup" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Check connection" })).toBeEnabled();
});
