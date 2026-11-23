import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminPricing from "../pages/admin/AdminPricing";
import Pricing from "../pages/Pricing";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy Pricing access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("saves published membership pricing and displays it on the public page", async () => {
  const items: Array<{ is_active: boolean }> = [];
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/pricing/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      expect(payload.action).toBe("item");
      items.push({ id: 1, ...payload.item });
      return Response.json({ saved: true });
    }
    if (path === "/api/studio/pricing") return Response.json({ content: null, items });
    if (path === "/api/public/pricing") return Response.json({ content: null, items: items.filter((item) => item.is_active) });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const editor = render(<AdminPricing />);
  fireEvent.change(screen.getByPlaceholderText("Plan name"), { target: { value: "Fixture membership" } });
  fireEvent.change(screen.getByPlaceholderText("Price (e.g. Rs 3,500)"), { target: { value: "NPR 2,000" } });
  fireEvent.change(screen.getByPlaceholderText("Subtitle"), { target: { value: "Gym access" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByText("Created successfully.")).toBeInTheDocument();
  editor.unmount();

  render(<MemoryRouter><Provider store={store}><Pricing /></Provider></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Fixture membership" })).toBeInTheDocument();
  expect(screen.getByText("NPR 2,000")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/api/public/pricing", expect.anything());
});
