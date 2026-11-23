import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminFacilities from "../pages/admin/AdminFacilities";
import Facilities from "../pages/Facilities";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy facilities access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("saves a zone and renders its image and title on the public Facilities page", async () => {
  const items: Array<{ is_active: boolean }> = [];
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/facilities/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      expect(payload.action).toBe("item");
      items.push({ id: 1, ...payload.item });
      return Response.json({ saved: true });
    }
    if (path === "/api/studio/facilities") return Response.json({ content: null, items });
    if (path === "/api/public/facilities") return Response.json({ content: null, items: items.filter((item) => item.is_active) });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const editor = render(<AdminFacilities />);
  fireEvent.change(screen.getByPlaceholderText("Zone title"), { target: { value: "New lifting zone" } });
  fireEvent.change(screen.getByPlaceholderText("Description"), { target: { value: "Fixture training floor" } });
  fireEvent.change(screen.getByPlaceholderText("Image URL (optional)"), { target: { value: "/fixture-lifting.webp" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByText("Created successfully.")).toBeInTheDocument();
  editor.unmount();

  render(<MemoryRouter><Provider store={store}><Facilities /></Provider></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "New lifting zone" })).toBeInTheDocument();
  for (const image of screen.getAllByAltText("New lifting zone")) expect(image).toHaveAttribute("src", "/fixture-lifting.webp");
  expect(request).toHaveBeenCalledWith("/api/public/facilities", expect.anything());
});
