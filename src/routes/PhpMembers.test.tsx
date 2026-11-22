import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import AdminLogin from "../pages/admin/AdminLogin";
import AdminMembers from "../pages/admin/AdminMembers";
import ProtectedAdminRoute from "../pages/admin/ProtectedAdminRoute";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy data access"); } }),
}));
vi.mock("@src/components/branding/LoginIntro", async () => {
  const { useEffect } = await import("react");
  return { default: function Intro({ onComplete }: { onComplete: () => void }) {
    useEffect(onComplete, [onComplete]);
    return null;
  } };
});

const admin = { id: "administrator", email: "admin@example.test", role: "admin" };
const json = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("signs in with PHP and loads the existing Members view through PHP endpoints", async () => {
  let signedIn = false;
  const fetchMock = vi.fn(async (path: string, options: RequestInit) => {
    if (path === "/api/auth/session") {
      return json({ user: signedIn ? admin : null, csrfToken: "session-csrf" });
    }
    if (path === "/api/auth/login") {
      expect(options.credentials).toBe("same-origin");
      expect(new Headers(options.headers).get("X-CSRF-Token")).toBe("session-csrf");
      expect(JSON.parse(String(options.body))).toEqual({ email: admin.email, password: "temporary test password" });
      signedIn = true;
      return json({ user: admin, csrfToken: "authenticated-csrf" });
    }
    if (path === "/api/admin/settings") return json({ settings: {} });
    if (path === "/api/members/plans") return json({ plans: [] });
    if (path.startsWith("/api/members?")) {
      return json({ members: [], count: 0, summary: { active: 0, enabled: 0, payment_follow_up: 0, deleted: 0 } });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<ProtectedAdminRoute />}>
          <Route path="/admin/members" element={<AdminMembers />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: admin.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "temporary test password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith("/api/members?"))).toBe(true);
  });
  expect(await screen.findByRole("heading", { name: /member management/i })).toBeInTheDocument();
});
