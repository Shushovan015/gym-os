import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminTestimonials from "../pages/admin/AdminTestimonials";
import Home from "../pages/Home";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy testimonial access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("saves a testimonial through the editor and shows it on the homepage", async () => {
  const items: Array<{ is_active: boolean }> = [];
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/testimonials/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      expect(payload.action).toBe("item");
      items.push({ id: 1, ...payload.item });
      return Response.json({ saved: true });
    }
    if (path === "/api/studio/testimonials") return Response.json({ items });
    if (path === "/api/public/home") return Response.json({ testimonials: items.filter((item) => item.is_active) });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const editor = render(<AdminTestimonials />);
  fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Fixture member" } });
  fireEvent.change(screen.getByPlaceholderText("Goal"), { target: { value: "Strength" } });
  fireEvent.change(screen.getByPlaceholderText("Quote"), { target: { value: "I improved my squat." } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByText("Created successfully.")).toBeInTheDocument();
  editor.unmount();

  render(<MemoryRouter><Provider store={store}><Home /></Provider></MemoryRouter>);
  expect(await screen.findByText("Fixture member")).toBeInTheDocument();
  expect(screen.getByText(/I improved my squat/)).toBeInTheDocument();
});
