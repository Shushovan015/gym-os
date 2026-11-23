import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminContact from "../pages/admin/AdminContact";
import Contact from "../pages/Contact";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy contact access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("saves an editor change through PHP and renders it after opening the public page", async () => {
  let content = { hero_title: "Original contact title" };
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/contact/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      expect(payload.action).toBe("content");
      content = payload.content;
      return Response.json({ saved: true });
    }
    if (path === "/api/studio/contact" || path === "/api/public/contact") {
      return Response.json({ content, faqs: [] });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const editor = render(<AdminContact />);
  fireEvent.change(await screen.findByDisplayValue("Original contact title"), { target: { value: "Updated contact title" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Contact Content" }));
  expect(await screen.findByText("Contact content saved.")).toBeInTheDocument();
  editor.unmount();

  render(<MemoryRouter><Provider store={store}><Contact /></Provider></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Updated contact title" })).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/api/public/contact", expect.anything());
});
