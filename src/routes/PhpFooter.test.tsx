import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminFooter from "../pages/admin/AdminFooter";
import Footer from "../pages/Footer";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy footer access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("saves and reloads the footer in the editor and on the public site", async () => {
  let content = { banner_title: "Previous footer title" };
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/footer/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      content = JSON.parse(String(options?.body)).content;
      return Response.json({ saved: true });
    }
    if (path === "/api/public/footer") return Response.json({ content });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  const editor = render(<AdminFooter />);
  fireEvent.change(await screen.findByDisplayValue("Previous footer title"), { target: { value: "Updated footer title" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Footer" }));
  expect(await screen.findByText("Footer content saved.")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Updated footer title")).toBeInTheDocument();
  editor.unmount();

  render(<MemoryRouter><Provider store={store}><Footer /></Provider></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Updated footer title" })).toBeInTheDocument();
});
