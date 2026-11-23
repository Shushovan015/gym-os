import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminProShop from "../pages/admin/AdminProShop";
import ProShop from "../pages/ProShop";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy shop access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("publishes a Studio product through PHP and displays public stock availability", async () => {
  const items: Array<{ is_active: boolean }> = [];
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/proshop/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      expect(payload.action).toBe("item");
      items.push({ id: 1, ...payload.item });
      return Response.json({ saved: true }, { status: 201 });
    }
    if (path === "/api/studio/proshop") return Response.json({ content: null, items });
    if (path === "/api/public/shop") {
      return Response.json({ content: null, items: items.filter((item) => item.is_active).map((item) => ({ ...item, availability: "available" })) });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const editor = render(<AdminProShop />);
  fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Fixture shaker" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByText("Product created.")).toBeInTheDocument();
  editor.unmount();

  render(<MemoryRouter><Provider store={store}><ProShop /></Provider></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Fixture shaker" })).toBeInTheDocument();
  expect(screen.getByText("Available")).toBeInTheDocument();
});
