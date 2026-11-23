import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminHome from "../pages/admin/AdminHome";
import Home from "../pages/Home";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy homepage access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("reloads saved homepage text and images and shows published items in order", async () => {
  let content = { hero_title: "Previous homepage title", hero_image: "/old-hero.webp" };
  const status = [
    { id: 1, label: "First announcement", value: "One", sort_order: 1, is_active: true },
    { id: 2, label: "Second announcement", value: "Two", sort_order: 2, is_active: true },
    { id: 3, label: "Private announcement", value: "Draft", sort_order: 3, is_active: false },
  ];
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/home/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      expect(payload.action).toBe("content");
      content = payload.content;
      return Response.json({ saved: true });
    }
    if (path === "/api/studio/home") return Response.json({ content, status, points: [] });
    if (path === "/api/public/home") return Response.json({ content, status: status.filter((row) => row.is_active), points: [], statusConfigured: true });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const editor = render(<AdminHome />);
  fireEvent.change(await screen.findByDisplayValue("Previous homepage title"), { target: { value: "Updated homepage title" } });
  fireEvent.change(screen.getByDisplayValue("/old-hero.webp"), { target: { value: "/new-hero.webp" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Home Content" }));
  expect(await screen.findByText("Home content saved.")).toBeInTheDocument();
  editor.unmount();
  const refreshedEditor = render(<AdminHome />);
  expect(await screen.findByDisplayValue("Updated homepage title")).toBeInTheDocument();
  expect(screen.getByDisplayValue("/new-hero.webp")).toBeInTheDocument();
  refreshedEditor.unmount();

  render(<MemoryRouter><Provider store={store}><Home /></Provider></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Updated homepage title" })).toBeInTheDocument();
  expect(screen.getByAltText("A&A Health Club training floor")).toHaveAttribute("src", "/new-hero.webp");
  expect(screen.getAllByRole("heading", { name: /announcement/ }).map((heading) => heading.textContent))
    .toEqual(["First announcement", "Second announcement"]);
  expect(request).toHaveBeenCalledWith("/api/public/home", expect.anything());
});
