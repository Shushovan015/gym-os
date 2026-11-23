import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { LegacyImportPage } from "../features/legacy-import/ui/LegacyImportPage";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy Supabase access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("previews and imports a legacy SQL file through PHP and shows records held for review", async () => {
  const sql = [
    "INSERT INTO `register` (`id`,`datebs`,`datead`,`name`,`sex`,`age`,`dob`,`nationality`,`occupation`,`telephone`,`mobile`,`email`,`caddress`,`taddress`) VALUES (42,NULL,'2021-08-25','Fixture Member',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);",
    "INSERT INTO `bill` (`bill_id`,`billno`,`tobepaid`,`amount`,`narration`,`paiddate`,`register_id`) VALUES (8,'OLD-8','50','10',NULL,'2021-08-25',42);",
    "INSERT INTO `users` (`id`,`username`,`password`,`name`,`time`) VALUES (1,'old-user','ignored-fixture',NULL,NULL);",
  ].join("\n");
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.startsWith("/api/members?")) return Response.json({ members: [] });
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/admin/legacy-import") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      expect(String(options?.body)).not.toContain("ignored-fixture");
      const data = JSON.parse(String(options?.body));
      expect(data.members[0]).toMatchObject({ source: { id: 42 }, profile: { full_name: "Fixture Member" } });
      expect(data.bills[0]).toMatchObject({ source: { bill_id: 8, register_id: 42 }, date: "2021-08-25" });
      return Response.json({ members: 1, invoices: 0, payments: 0, evidence: 2, skipped: 0,
        review: [{ entity: "bill", id: 8, reason: "The original bill amounts need reconciliation." }] });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  render(<MemoryRouter><LegacyImportPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/Click to select/), { target: { files: [new File([sql], "fixture.sql")] } });
  await waitFor(() => {
    if (!screen.queryByRole("heading", { name: "Import Preview" })) {
      fireEvent.click(screen.getByRole("button", { name: "Preview Import" }));
    }
    expect(screen.getByRole("heading", { name: "Import Preview" })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Execute Import" }));
  expect(await screen.findByText(/bill #8: The original bill amounts need reconciliation/)).toBeInTheDocument();
});
