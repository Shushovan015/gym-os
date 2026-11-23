import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminHolidayManager from "../pages/admin/AdminHolidayManager";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy holidays access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("uses PHP to save and apply a recurring Bikram Sambat holiday", async () => {
  let templates: object[] = [];
  let holidays: object[] = [];
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.startsWith("/api/admin/holidays?")) return Response.json({ holidays });
    if (path === "/api/admin/holiday-templates") return Response.json({ templates });
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/admin/holidays/change") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      if (payload.action === "create-template") {
        templates = [{ id: 1, name: payload.name, bs_month: payload.month, bs_day: payload.day, is_active: true }];
        return Response.json({ saved: true });
      }
      expect(payload.action).toBe("apply");
      expect(payload.days.length).toBeGreaterThanOrEqual(29);
      holidays = [{ id: 1, holiday_date: payload.days[0], name: "Fixture annual holiday" }];
      return Response.json({ applied: 1 });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  render(<AdminHolidayManager />);
  fireEvent.change(await screen.findByPlaceholderText("Template occasion"), { target: { value: "Fixture annual holiday" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Template" }));
  expect(await screen.findByText("Fixture annual holiday")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Apply Templates" }));
  expect(await screen.findByText("Applied 1 template holiday(s).")).toBeInTheDocument();
  expect(screen.getAllByText("Fixture annual holiday").length).toBeGreaterThan(1);
});
