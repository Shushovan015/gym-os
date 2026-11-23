import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminReports from "../pages/admin/AdminReports";
import { getNepalTodayAdDate } from "../pages/admin/adminUtils";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy report access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("loads the Nepal-local monthly report through PHP and prints the selected report", async () => {
  const today = getNepalTodayAdDate();
  const request = vi.fn(async (_url: string) => new Response(JSON.stringify({
    settings: { gym_name: "Fixture Gym" },
    members: [],
    invoices: [],
    items: [],
    payments: [],
    products: [],
    variants: [],
  })));
  const print = vi.fn();
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("print", print);
  render(<AdminReports />);
  expect(await screen.findByRole("heading", { name: "Monthly reports" })).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/admin\/reports\?start=\d{4}-\d{2}-\d{2}&end=/), expect.anything());
  expect(new URL(String(request.mock.calls[0]?.[0]), "https://example.test").searchParams.get("end")).toBe(today);
  fireEvent.click(screen.getByRole("button", { name: /product sales & profit report/i }));
  fireEvent.click(screen.getByRole("button", { name: /save product pdf/i }));
  expect(print).toHaveBeenCalledOnce();
});
