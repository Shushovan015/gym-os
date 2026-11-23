import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import AdminLogin from "../pages/admin/AdminLogin";
import AdminMembers from "../pages/admin/AdminMembers";
import ProtectedAdminRoute from "../pages/admin/ProtectedAdminRoute";
import { formatMembershipFeeAmount } from "../pages/admin/adminUtils";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy data access"); } }),
}));
vi.mock("@src/components/branding/LoginIntro", async () => {
  const { useEffect } = await import("react");
  return { default: function Intro({ onComplete }: { onComplete: () => void }) {
    useEffect(onComplete, [onComplete]);
    return null;
  } };
});

const admin = { id: "administrator", email: "admin@example.test", role: "admin" };
const json = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("signs in with PHP and loads the existing Members view through PHP endpoints", async () => {
  let signedIn = false;
  const fetchMock = vi.fn(async (path: string, options: RequestInit) => {
    if (path === "/api/auth/session") {
      return json({ user: signedIn ? admin : null, csrfToken: "session-csrf" });
    }
    if (path === "/api/auth/login") {
      expect(options.credentials).toBe("same-origin");
      expect(new Headers(options.headers).get("X-CSRF-Token")).toBe("session-csrf");
      expect(JSON.parse(String(options.body))).toEqual({ email: admin.email, password: "temporary test password" });
      signedIn = true;
      return json({ user: admin, csrfToken: "authenticated-csrf" });
    }
    if (path === "/api/admin/settings") return json({ settings: {} });
    if (path === "/api/members/plans") return json({ plans: [] });
    if (path.startsWith("/api/members?")) {
      const member = {
        id: 81, member_id: "GYM-81", full_name: "Test Member", email: null, phone: "9800000000",
        membership_type: "Monthly", membership_status: "active", payment_status: "paid", is_active: true,
        start_date: null, end_date: null, payment_due_date: null, last_visit_date: null,
        deleted_at: null, address: null, notes: null, photo_url: null,
      };
      return json({ members: [member], count: 1, summary: { active: 1, enabled: 1, payment_follow_up: 0, deleted: 0 } });
    }
    if (path === "/api/attendance/history?memberId=81") return json({ records: [] });
    if (path === "/api/members/fees?id=81") return json({ has_outstanding: false, paid_fees: [], outstanding_fees: [] });
    if (path === "/api/membership/payment-history?id=81") return json({ payments: [{
      id: 11, invoice_number: "123", payment_date: "2024-02-29", amount_minor: 10000, currency_code: "NPR", is_reversal: true,
    }] });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<ProtectedAdminRoute />}>
          <Route path="/admin/members" element={<AdminMembers />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: admin.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "temporary test password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith("/api/members?"))).toBe(true);
  });
  expect(await screen.findByRole("heading", { name: /member management/i })).toBeInTheDocument();
  fireEvent.click((await screen.findAllByRole("button", { name: /Test Member/i }))[0]);
  expect(await screen.findByText("Recent invoice payments")).toBeInTheDocument();
  expect(screen.getByText("Bill 123")).toBeInTheDocument();
  expect(screen.getByText(`Reversed ${formatMembershipFeeAmount(10000, "NPR")}`)).toBeInTheDocument();
});

it("imports the existing CSV format through PHP", async () => {
  const fetchMock = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return json({ user: admin, csrfToken: "authenticated-csrf" });
    if (path === "/api/admin/settings") return json({ settings: {}, memberWebhookConfigured: true });
    if (path === "/api/members/plans") return json({ plans: [] });
    if (path.startsWith("/api/members?")) {
      return json({ members: [], count: 0, summary: { active: 0, enabled: 0, payment_follow_up: 0, deleted: 0 } });
    }
    if (path === "/api/members/import-csv") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("authenticated-csrf");
      expect(JSON.parse(String(options?.body)).rows).toMatchObject([{ member_id: "CSV-1", full_name: "Fixture Personal Record", payment_status: "unpaid" }]);
      return json({ imported: 1, protectedPaymentProfiles: 0, notification: "delivered" });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><AdminMembers /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "CSV import" }));
  const csv = "member_id,full_name,email,phone,membership_type,membership_status,start_date,end_date,last_visit_date,payment_status,payment_due_date,notes\n"
    + "CSV-1,Fixture Personal Record,,+9779800000000,monthly,active,,,,unpaid,,";
  const file = new File([csv], "fixture.csv");
  Object.defineProperty(file, "text", { value: async () => csv });
  fireEvent.change(screen.getByLabelText("CSV file"), { target: { files: [file] } });
  fireEvent.click(await screen.findByRole("button", { name: "Import 1 rows" }));
  expect(await screen.findByText("Imported 1 members. Webhook notified.")).toBeInTheDocument();
});
