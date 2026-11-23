import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { InvoiceRow } from "./types";
import { useBillEmail } from "./useBillEmail";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy email request"); } }),
}));

const invoice = { id: 4, invoice_number: "EMAIL-TEST", member_ref: 2, invoice_status: "issued" } as InvoiceRow;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function BillEmail() {
  const feature = useBillEmail([invoice], null, () => {});
  return <>{feature.button(invoice)}{feature.dialog}</>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("confirms the server-selected address and prevents retry after uncertain delivery", async () => {
  const recipient = "member@example.test";
  const fetchMock = vi.fn(async (path: string, request?: RequestInit) => {
    if (path === "/api/invoices/email?id=4") return json({ sender: "billing@example.test", recipient, delivery: null });
    if (path === "/api/auth/session") return json({ csrfToken: "fixture-token" });
    if (path === "/api/invoices/email/send") {
      expect(new Headers(request?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      expect(JSON.parse(String(request?.body))).toEqual({ invoiceId: 4, expectedEmail: recipient });
      return json({ delivery: { invoice_id: 4, status: "uncertain", message_token: "fixture-reference" } });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<BillEmail />);
  fireEvent.click(screen.getByRole("button", { name: "Send Bill" }));
  expect(await screen.findByText(recipient)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send" }));
  expect(await screen.findByText(/resending is blocked/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm and send" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Record confirmed delivery" })).toBeEnabled();
});
