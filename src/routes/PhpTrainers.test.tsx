import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { store } from "../redux/store";
import AdminTrainers from "../pages/admin/AdminTrainers";
import Trainers from "../pages/Trainers";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy trainer access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("saves a personal-training plan in the editor and renders it on the public page", async () => {
  const plans: Array<{ is_active: boolean }> = [];
  const request = vi.fn(async (path: string, options?: RequestInit) => {
    if (path === "/api/auth/session") return Response.json({ csrfToken: "fixture-token" });
    if (path === "/api/studio/trainers/save") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("fixture-token");
      const payload = JSON.parse(String(options?.body));
      expect(payload).toMatchObject({ action: "item", entity: "plan" });
      plans.push({ id: 1, ...payload.item });
      return Response.json({ saved: true });
    }
    if (path === "/api/studio/trainers") return Response.json({ ptContent: null, trainers: [], plans });
    if (path === "/api/public/trainers") return Response.json({ ptContent: null, trainers: [], plans: plans.filter((plan) => plan.is_active) });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const editor = render(<AdminTrainers />);
  const planName = screen.getByLabelText("Plan Name");
  fireEvent.change(planName, { target: { value: "New coaching plan" } });
  fireEvent.click(within(planName.closest("form")!).getByRole("button", { name: "Create" }));
  expect(await screen.findByText("Plan created.")).toBeInTheDocument();
  editor.unmount();

  render(<MemoryRouter><Provider store={store}><Trainers /></Provider></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "New coaching plan" })).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/api/public/trainers", expect.anything());
});
