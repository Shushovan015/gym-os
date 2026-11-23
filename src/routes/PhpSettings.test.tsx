import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import AdminSettings from "../pages/admin/AdminSettings";
import { defaultAdminSettings } from "../pages/admin/adminUtils";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy settings access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("loads and saves operational settings through PHP and displays SMTP readiness", async () => {
  let settings = { ...defaultAdminSettings, gym_name: "Original gym", email: "gym@example.test" };
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/admin/backups") return Response.json({ configured: true,
      archives: [{ name: "gym-20260515-120000-0123456789abcdef.zip", bytes: 200, createdAt: "2026-05-15T12:00:00Z" }] });
    if (path === "/api/admin/settings/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      settings = JSON.parse(String(options?.body));
    } else if (path !== "/api/admin/settings") throw new Error(`Unexpected request: ${path}`);
    return Response.json({ settings, smtpConfigured: true });
  });
  vi.stubGlobal("fetch", request);
  const editor = render(<MemoryRouter><AdminSettings /></MemoryRouter>);
  fireEvent.change(await screen.findByDisplayValue("Original gym"), { target: { value: "Updated gym name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  expect(screen.getByText("Invoice email (SMTP)")).toBeInTheDocument();
  expect(screen.getByText("Configured")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "Download archive" }))
    .toHaveAttribute("href", "/api/admin/backups/download?file=gym-20260515-120000-0123456789abcdef.zip");
  editor.unmount();
  render(<MemoryRouter><AdminSettings /></MemoryRouter>);
  expect(await screen.findByDisplayValue("Updated gym name")).toBeInTheDocument();
});
